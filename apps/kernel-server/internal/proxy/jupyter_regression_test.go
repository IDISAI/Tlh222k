package proxy

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/lh222k/kernel-server/internal/sessions"
	"nhooyr.io/websocket"
)

type mutableClock struct{ now time.Time }

func (c *mutableClock) Now() time.Time { return c.now }

func TestTicketAuthenticatesProxyWithoutClerkHeader(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	manager, session := newTestManager(t, upstream.URL)
	tickets := NewTickets([]byte("test-secret"), time.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/sessions/{id}/jupyter/{path...}", NewJupyter(manager, tickets, nil).ServeHTTP)
	server := httptest.NewServer(mux)
	defer server.Close()

	requestURL := fmt.Sprintf("%s/api/sessions/%s/jupyter/api/status?ticket=%s", server.URL, session.ID, url.QueryEscape(ticket))
	response, err := http.Get(requestURL)
	if err != nil {
		t.Fatalf("proxy request: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", response.StatusCode)
	}
}

func TestWebSocketAllowsConfiguredBrowserOriginAndTouchesActivity(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connection, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer connection.CloseNow()
		messageType, payload, err := connection.Read(r.Context())
		if err == nil {
			_ = connection.Write(r.Context(), messageType, payload)
		}
	}))
	defer upstream.Close()

	clock := &mutableClock{now: time.Unix(1_000, 0)}
	manager := sessions.NewManager(sessions.Options{MaxSessions: 1, IdleTimeout: 15 * time.Minute}, testRuntime{endpoint: upstream.URL}, clock)
	session, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	tickets := NewTickets([]byte("test-secret"), clock.Now)
	ticket, _, err := tickets.Issue(session.ID, session.Owner)
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/sessions/{id}/jupyter/{path...}", NewJupyter(manager, tickets, []string{"http://localhost:3000"}).ServeHTTP)
	server := httptest.NewServer(mux)
	defer server.Close()

	clock.now = clock.now.Add(2 * time.Minute)
	wsURL := "ws" + server.URL[len("http"):] + fmt.Sprintf("/api/sessions/%s/jupyter/api/kernels/kernel-1/channels?ticket=%s", session.ID, url.QueryEscape(ticket))
	connection, response, err := websocket.Dial(context.Background(), wsURL, &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": []string{"http://localhost:3000"}},
	})
	if err != nil {
		if response != nil {
			t.Fatalf("dial proxy websocket: %v (status %d)", err, response.StatusCode)
		}
		t.Fatalf("dial proxy websocket: %v", err)
	}
	defer connection.CloseNow()

	if err := connection.Write(context.Background(), websocket.MessageText, []byte("ping")); err != nil {
		t.Fatalf("write message: %v", err)
	}
	if _, _, err := connection.Read(context.Background()); err != nil {
		t.Fatalf("read message: %v", err)
	}
	updated, err := manager.Get(session.Owner, session.ID)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if !updated.LastActivity.Equal(clock.now) {
		t.Fatalf("last activity = %s, want %s", updated.LastActivity, clock.now)
	}
}
