package proxy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/lh222k/kernel-server/internal/sessions"
	"nhooyr.io/websocket"
)

type Jupyter struct {
	manager        *sessions.Manager
	tickets        *Tickets
	originPatterns []string
}

func NewJupyter(manager *sessions.Manager, tickets *Tickets, allowedOrigins []string) *Jupyter {
	return &Jupyter{manager: manager, tickets: tickets, originPatterns: originPatterns(allowedOrigins)}
}

func (p *Jupyter) Control(ctx context.Context, session sessions.Session, action string) error {
	if action != "interrupt" && action != "restart" {
		return fmt.Errorf("unsupported kernel action %q", action)
	}
	upstream, err := url.Parse(session.Handle.Endpoint)
	if err != nil {
		return err
	}
	upstream.Path = joinPath(upstream.Path, "api/kernels")
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, upstream.String(), nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "token "+session.Handle.Token)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("list kernels: upstream status %d", response.StatusCode)
	}
	var kernels []struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(response.Body).Decode(&kernels); err != nil {
		return err
	}
	for _, kernel := range kernels {
		controlURL := *upstream
		controlURL.Path = joinPath(upstream.Path, url.PathEscape(kernel.ID)+"/"+action)
		controlRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, controlURL.String(), nil)
		if err != nil {
			return err
		}
		controlRequest.Header.Set("Authorization", "token "+session.Handle.Token)
		controlResponse, err := http.DefaultClient.Do(controlRequest)
		if err != nil {
			return err
		}
		controlResponse.Body.Close()
		if controlResponse.StatusCode < 200 || controlResponse.StatusCode >= 300 {
			return fmt.Errorf("%s kernel: upstream status %d", action, controlResponse.StatusCode)
		}
	}
	return p.manager.Touch(session.Owner, session.ID)
}

func (p *Jupyter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if queryContainsSecret(r) {
		http.Error(w, `{"error":"query credentials are forbidden"}`, http.StatusBadRequest)
		return
	}
	ticket := clientTicket(r)
	subject, err := p.tickets.Verify(ticket, sessionID)
	if ticket == "" || err != nil {
		http.Error(w, `{"error":"invalid connection ticket"}`, http.StatusUnauthorized)
		return
	}
	session, err := p.manager.Get(subject, sessionID)
	if err != nil {
		writeSessionError(w, err)
		return
	}
	if err := p.manager.Touch(subject, sessionID); err != nil {
		writeSessionError(w, err)
		return
	}

	if websocketUpgrade(r) {
		p.serveWebSocket(w, r, session)
		return
	}
	p.serveHTTP(w, r, session)
}

func (p *Jupyter) serveHTTP(w http.ResponseWriter, r *http.Request, session sessions.Session) {
	upstream, err := url.Parse(session.Handle.Endpoint)
	if err != nil {
		http.Error(w, `{"error":"invalid runtime endpoint"}`, http.StatusBadGateway)
		return
	}
	path := r.PathValue("path")
	query := r.URL.Query()
	query.Del("ticket")
	query.Del("token")
	proxy := httputil.NewSingleHostReverseProxy(upstream)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.URL.Path = joinPath(upstream.Path, path)
		request.URL.RawPath = ""
		request.URL.RawQuery = query.Encode()
		request.Host = upstream.Host
		request.Header.Set("Authorization", "token "+session.Handle.Token)
	}
	// Tornado reflects CORS headers; kernel-server's CORS middleware already
	// set them, and duplicates make the browser reject the response.
	proxy.ModifyResponse = func(response *http.Response) error {
		for header := range response.Header {
			if strings.HasPrefix(header, "Access-Control-") {
				response.Header.Del(header)
			}
		}
		cookie, _, err := p.tickets.IssueCookie(session.ID, session.Owner)
		if err != nil {
			return fmt.Errorf("rotate connection ticket: %w", err)
		}
		response.Header.Add("Set-Cookie", cookie.String())
		setProxySecurityHeaders(response.Header)
		return nil
	}
	proxy.ServeHTTP(w, r)
}

func (p *Jupyter) serveWebSocket(w http.ResponseWriter, r *http.Request, session sessions.Session) {
	upstreamURL, err := url.Parse(session.Handle.Endpoint)
	if err != nil {
		http.Error(w, `{"error":"invalid runtime endpoint"}`, http.StatusBadGateway)
		return
	}
	if upstreamURL.Scheme == "https" {
		upstreamURL.Scheme = "wss"
	} else {
		upstreamURL.Scheme = "ws"
	}
	upstreamURL.Path = joinPath(upstreamURL.Path, r.PathValue("path"))
	query := r.URL.Query()
	query.Del("ticket")
	query.Del("token")
	upstreamURL.RawQuery = query.Encode()

	headers := make(http.Header)
	headers.Set("Authorization", "token "+session.Handle.Token)
	subprotocols := websocketSubprotocols(r)
	upstream, response, err := websocket.Dial(r.Context(), upstreamURL.String(), &websocket.DialOptions{
		HTTPHeader:   headers,
		Subprotocols: subprotocols,
	})
	if err != nil {
		status := http.StatusBadGateway
		if response != nil {
			status = response.StatusCode
		}
		http.Error(w, `{"error":"runtime websocket unavailable"}`, status)
		return
	}
	defer upstream.CloseNow()
	cookie, _, err := p.tickets.IssueCookie(session.ID, session.Owner)
	if err != nil {
		http.Error(w, `{"error":"connection ticket unavailable"}`, http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, cookie)
	setProxySecurityHeaders(w.Header())

	acceptOptions := &websocket.AcceptOptions{OriginPatterns: p.originPatterns}
	if selected := upstream.Subprotocol(); selected != "" {
		acceptOptions.Subprotocols = []string{selected}
	}
	client, err := websocket.Accept(w, r, acceptOptions)
	if err != nil {
		return
	}
	defer client.CloseNow()

	// Default read limit is 32KB, which drops any display_data larger than
	// that (a matplotlib PNG easily exceeds it) and kills the kernel channel
	// mid-execute. Jupyter server itself caps messages at 10MB (Tornado
	// websocket_max_message_size); 64MB leaves headroom for both directions.
	const maxKernelMessage = 64 << 20
	upstream.SetReadLimit(maxKernelMessage)
	client.SetReadLimit(maxKernelMessage)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	finished := make(chan struct{}, 2)
	relay := func(destination, source *websocket.Conn) {
		defer func() { finished <- struct{}{} }()
		for {
			messageType, payload, err := source.Read(ctx)
			if err != nil {
				return
			}
			if err := destination.Write(ctx, messageType, payload); err != nil {
				return
			}
			if err := p.manager.Touch(session.Owner, session.ID); err != nil {
				return
			}
		}
	}
	go relay(upstream, client)
	go relay(client, upstream)
	<-finished
	cancel()
}

func originPatterns(origins []string) []string {
	patterns := make([]string, 0, len(origins))
	for _, origin := range origins {
		parsed, err := url.Parse(origin)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			continue
		}
		patterns = append(patterns, parsed.Host)
	}
	return patterns
}

func clientTicket(r *http.Request) string {
	cookie, err := r.Cookie(ticketCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func queryContainsSecret(r *http.Request) bool {
	query := r.URL.Query()
	return query.Has("ticket") || query.Has("token")
}

func setProxySecurityHeaders(header http.Header) {
	header.Set("Cache-Control", "no-store")
	header.Set("Referrer-Policy", "no-referrer")
}

func websocketUpgrade(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket") &&
		strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade")
}

func websocketSubprotocols(r *http.Request) []string {
	var protocols []string
	for _, value := range r.Header.Values("Sec-WebSocket-Protocol") {
		for _, protocol := range strings.Split(value, ",") {
			if protocol = strings.TrimSpace(protocol); protocol != "" {
				protocols = append(protocols, protocol)
			}
		}
	}
	return protocols
}

func joinPath(base, suffix string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(suffix, "/")
}

func writeSessionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sessions.ErrForbidden):
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
	case errors.Is(err, sessions.ErrNotFound):
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
	default:
		http.Error(w, `{"error":"session unavailable"}`, http.StatusInternalServerError)
	}
}
