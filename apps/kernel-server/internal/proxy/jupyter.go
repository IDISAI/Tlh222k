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

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/sessions"
	"nhooyr.io/websocket"
)

type Jupyter struct {
	manager *sessions.Manager
	tickets *Tickets
}

func NewJupyter(manager *sessions.Manager, tickets *Tickets) *Jupyter {
	return &Jupyter{manager: manager, tickets: tickets}
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
	principal := auth.PrincipalFrom(r)
	sessionID := r.PathValue("id")
	ticket := clientTicket(r)
	if ticket == "" || p.tickets.Validate(ticket, sessionID, principal.Subject) != nil {
		http.Error(w, `{"error":"invalid connection ticket"}`, http.StatusUnauthorized)
		return
	}
	session, err := p.manager.Get(principal.Subject, sessionID)
	if err != nil {
		writeSessionError(w, err)
		return
	}
	if err := p.manager.Touch(principal.Subject, sessionID); err != nil {
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

	acceptOptions := &websocket.AcceptOptions{}
	if selected := upstream.Subprotocol(); selected != "" {
		acceptOptions.Subprotocols = []string{selected}
	}
	client, err := websocket.Accept(w, r, acceptOptions)
	if err != nil {
		return
	}
	defer client.CloseNow()

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
		}
	}
	go relay(upstream, client)
	go relay(client, upstream)
	<-finished
	cancel()
}

func clientTicket(r *http.Request) string {
	if ticket := r.URL.Query().Get("ticket"); ticket != "" {
		return ticket
	}
	if ticket := r.URL.Query().Get("token"); ticket != "" {
		return ticket
	}
	for _, prefix := range []string{"token ", "Bearer "} {
		if ticket, ok := strings.CutPrefix(r.Header.Get("Authorization"), prefix); ok {
			return strings.TrimSpace(ticket)
		}
	}
	return ""
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
