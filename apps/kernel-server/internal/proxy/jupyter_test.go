package proxy

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	mux.HandleFunc("/api/sessions/{id}/jupyter/{path...}", auth.RequireAuthenticated(NewJupyter(manager, tickets).ServeHTTP))
	return httptest.NewServer(auth.New("admin", "").Middleware(mux))
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

	requestURL := fmt.Sprintf("%s/api/sessions/%s/jupyter/api/kernels?ticket=%s&existing=1", server.URL, session.ID, url.QueryEscape(ticket))
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	request.Header.Set("Authorization", "token "+ticket)
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

	wsURL := "ws" + server.URL[len("http"):] + fmt.Sprintf("/api/sessions/%s/jupyter/api/kernels/kernel-1/channels?ticket=%s", session.ID, url.QueryEscape(ticket))
	connection, response, err := websocket.Dial(context.Background(), wsURL, nil)
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
