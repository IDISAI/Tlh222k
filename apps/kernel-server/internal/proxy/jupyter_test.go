package proxy

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/sessions"
	"nhooyr.io/websocket"
)

type testRuntime struct{ endpoint string }

func (r testRuntime) Start(context.Context, sessions.StartRequest) (sessions.RuntimeHandle, error) {
	return sessions.RuntimeHandle{ID: "container-1", Endpoint: r.endpoint, Token: "internal-jupyter-token"}, nil
}

func (testRuntime) Stop(context.Context, string) error { return nil }

func (testRuntime) Alive(context.Context, string) bool { return true }

func newTestManager(t *testing.T, endpoint string) (*sessions.Manager, sessions.Session) {
	t.Helper()
	manager := sessions.NewManager(sessions.Options{
		MaxSessions: 1,
		IdleTimeout: 15 * time.Minute,
	}, testRuntime{endpoint: endpoint}, sessions.SystemClock{})
	session, err := manager.CreateOrResume(context.Background(), "dev:admin", "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	return manager, session
}

func proxyServer(t *testing.T, manager *sessions.Manager, tickets *Tickets) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/sessions/{id}/jupyter/{path...}", auth.RequireAuthenticated(NewJupyter(manager, tickets, nil).ServeHTTP))
	return httptest.NewServer(auth.New(auth.Options{DevRole: "admin"}).Middleware(mux))
}

func TestProxyStripsClientTicketAndInjectsJupyterToken(t *testing.T) {
	seen := make(chan *http.Request, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Clone(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), time.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	server := proxyServer(t, manager, tickets)
	defer server.Close()

	requestURL := fmt.Sprintf("%s/api/sessions/%s/jupyter/api/kernels?existing=1", server.URL, session.ID)
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	request.AddCookie(&http.Cookie{Name: ticketCookieName, Value: ticket})
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("proxy request: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("status = %d, want 204: %s", response.StatusCode, body)
	}

	upstreamRequest := <-seen
	if got := upstreamRequest.Header.Get("Authorization"); got != "token internal-jupyter-token" {
		t.Fatalf("upstream authorization = %q, want internal token", got)
	}
	if got := upstreamRequest.URL.Query().Get("ticket"); got != "" {
		t.Fatalf("upstream ticket = %q, want stripped", got)
	}
	if got := upstreamRequest.URL.Query().Get("existing"); got != "1" {
		t.Fatalf("upstream existing query = %q, want preserved", got)
	}
}

func TestProxyRejectsQueryTicketEvenWithValidCookie(t *testing.T) {
	upstreamCalled := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamCalled = true
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()
	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), time.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	server := proxyServer(t, manager, tickets)
	defer server.Close()

	request, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/sessions/%s/jupyter/api/status?ticket=leaked", server.URL, session.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	request.AddCookie(&http.Cookie{Name: ticketCookieName, Value: ticket})
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusBadRequest || upstreamCalled {
		t.Fatalf("status/upstream = %d/%v, want 400/false", response.StatusCode, upstreamCalled)
	}
}

func TestSuccessfulProxyResponseRotatesFiveMinuteTicketCookie(t *testing.T) {
	now := time.Unix(10_000, 0)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()
	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), func() time.Time { return now })
	initial, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Minute)
	server := proxyServer(t, manager, tickets)
	defer server.Close()
	request, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/sessions/%s/jupyter/api/status", server.URL, session.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	request.AddCookie(&http.Cookie{Name: ticketCookieName, Value: initial})
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	var rotated *http.Cookie
	for _, cookie := range response.Cookies() {
		if cookie.Name == ticketCookieName {
			rotated = cookie
		}
	}
	if rotated == nil || rotated.Value == initial {
		t.Fatalf("rotated cookie = %#v, want fresh ticket", rotated)
	}
	if !rotated.Expires.Equal(now.Add(5*time.Minute)) || rotated.MaxAge != 300 {
		t.Fatalf("rotated expiry/max-age = %v/%d", rotated.Expires, rotated.MaxAge)
	}
	if response.Header.Get("Cache-Control") != "no-store" || response.Header.Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("security headers = Cache-Control:%q Referrer-Policy:%q", response.Header.Get("Cache-Control"), response.Header.Get("Referrer-Policy"))
	}
}

func TestProxyStripsUpstreamCORSHeaders(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Tornado reflects the request Origin; the middleware already sets CORS.
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3002")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), time.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	server := proxyServer(t, manager, tickets)
	defer server.Close()

	requestURL := fmt.Sprintf("%s/api/sessions/%s/jupyter/api/status", server.URL, session.ID)
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.AddCookie(&http.Cookie{Name: ticketCookieName, Value: ticket})
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("proxy request: %v", err)
	}
	defer response.Body.Close()
	if got := response.Header.Values("Access-Control-Allow-Origin"); len(got) != 0 {
		t.Fatalf("Access-Control-Allow-Origin = %v, want stripped from upstream response", got)
	}
	if got := response.Header.Values("Access-Control-Allow-Credentials"); len(got) != 0 {
		t.Fatalf("Access-Control-Allow-Credentials = %v, want stripped from upstream response", got)
	}
}

func TestWebSocketRelayPreservesBinaryMessage(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "token internal-jupyter-token" {
			http.Error(w, "missing internal token", http.StatusUnauthorized)
			return
		}
		connection, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer connection.CloseNow()
		messageType, payload, err := connection.Read(r.Context())
		if err != nil {
			return
		}
		_ = connection.Write(r.Context(), messageType, payload)
	}))
	defer upstream.Close()

	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), time.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	server := proxyServer(t, manager, tickets)
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):] + fmt.Sprintf("/api/sessions/%s/jupyter/api/kernels/kernel-1/channels", session.ID)
	connection, response, err := websocket.Dial(context.Background(), wsURL, &websocket.DialOptions{HTTPHeader: ticketRequestHeader(ticket)})
	if err != nil {
		if response != nil {
			t.Fatalf("dial proxy websocket: %v (status %d)", err, response.StatusCode)
		}
		t.Fatalf("dial proxy websocket: %v", err)
	}
	defer connection.CloseNow()

	want := []byte{0x00, 0xff, 0x80, 0x01}
	if err := connection.Write(context.Background(), websocket.MessageBinary, want); err != nil {
		t.Fatalf("write binary message: %v", err)
	}
	messageType, got, err := connection.Read(context.Background())
	if err != nil {
		t.Fatalf("read binary message: %v", err)
	}
	if messageType != websocket.MessageBinary {
		t.Fatalf("message type = %v, want binary", messageType)
	}
	if string(got) != string(want) {
		t.Fatalf("payload = %v, want %v", got, want)
	}
}

// A matplotlib PNG display_data easily exceeds nhooyr's 32KB default read
// limit; the relay must not drop it (it used to kill the kernel channel).
func TestWebSocketRelayPreservesLargeMessage(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connection, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer connection.CloseNow()
		connection.SetReadLimit(64 << 20)
		messageType, payload, err := connection.Read(r.Context())
		if err != nil {
			return
		}
		_ = connection.Write(r.Context(), messageType, payload)
	}))
	defer upstream.Close()

	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), time.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	server := proxyServer(t, manager, tickets)
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):] + fmt.Sprintf("/api/sessions/%s/jupyter/api/kernels/kernel-1/channels", session.ID)
	connection, _, err := websocket.Dial(context.Background(), wsURL, &websocket.DialOptions{HTTPHeader: ticketRequestHeader(ticket)})
	if err != nil {
		t.Fatalf("dial proxy websocket: %v", err)
	}
	defer connection.CloseNow()
	connection.SetReadLimit(64 << 20)

	want := strings.Repeat("x", 256<<10) // 256KB, 8x the default limit
	if err := connection.Write(context.Background(), websocket.MessageText, []byte(want)); err != nil {
		t.Fatalf("write large message: %v", err)
	}
	_, got, err := connection.Read(context.Background())
	if err != nil {
		t.Fatalf("read large message: %v", err)
	}
	if len(got) != len(want) {
		t.Fatalf("payload length = %d, want %d", len(got), len(want))
	}
}

func ticketRequestHeader(ticket string) http.Header {
	header := make(http.Header)
	header.Set("Cookie", (&http.Cookie{Name: ticketCookieName, Value: ticket}).String())
	return header
}
