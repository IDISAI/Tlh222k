package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/proxy"
	"github.com/lh222k/kernel-server/internal/sessions"
)

type routeRuntime struct{}

func (routeRuntime) Start(context.Context, sessions.StartRequest) (sessions.RuntimeHandle, error) {
	return sessions.RuntimeHandle{ID: "container-1", Endpoint: "http://jupyter:8888", Token: "internal-token"}, nil
}

func (routeRuntime) Stop(context.Context, string) error { return nil }

func (routeRuntime) Alive(context.Context, string) bool { return true }

func routeManager(t *testing.T, owner string) (*sessions.Manager, sessions.Session) {
	t.Helper()
	manager := sessions.NewManager(sessions.Options{MaxSessions: 2, IdleTimeout: 15 * time.Minute}, routeRuntime{}, sessions.SystemClock{})
	session, err := manager.CreateOrResume(context.Background(), owner, "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	return manager, session
}

func TestSessionRouteReturns401WithoutPrincipal(t *testing.T) {
	manager, session := routeManager(t, "user-1")
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now), nil).Register(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/sessions/"+session.ID, nil))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
}

func TestSessionRouteReturns403ForDifferentOwner(t *testing.T) {
	manager, session := routeManager(t, "different-owner")
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now), nil).Register(mux)
	handler := auth.New(auth.Options{DevRole: "admin"}).Middleware(mux)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/sessions/"+session.ID, nil))

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", recorder.Code)
	}
}

// Switching a notebook's language reuses the learner's single sandbox slot.
func TestCreateSessionSwapsTheOwnersProfileInPlace(t *testing.T) {
	manager, first := routeManager(t, "dev:admin")
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now), nil).Register(mux)
	handler := auth.New(auth.Options{DevRole: "admin"}).Middleware(mux)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(`{"profile":"javascript"}`))
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	var body struct {
		ID      string `json:"id"`
		Profile string `json:"profile"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode session: %v", err)
	}
	if body.Profile != "javascript" || body.ID == first.ID {
		t.Fatalf("session = %+v, want a new javascript session", body)
	}
}

// The global cap still refuses work; only the per-owner slot is reclaimable.
func TestCreateSessionReturns429WhenTheServerIsFull(t *testing.T) {
	manager := sessions.NewManager(
		sessions.Options{MaxSessions: 1, IdleTimeout: 15 * time.Minute},
		routeRuntime{}, sessions.SystemClock{},
	)
	if _, err := manager.CreateOrResume(context.Background(), "someone-else", "data-science"); err != nil {
		t.Fatalf("create other owner's session: %v", err)
	}
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now), nil).Register(mux)
	handler := auth.New(auth.Options{DevRole: "admin"}).Middleware(mux)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(`{"profile":"data-science"}`))
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", recorder.Code)
	}
}

func TestCreateSessionSetsHttpOnlyTicketCookieWithoutReturningSecret(t *testing.T) {
	manager, _ := routeManager(t, "dev:admin")
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now), nil).Register(mux)
	handler := auth.New(auth.Options{DevRole: "admin"}).Middleware(mux)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(`{"profile":"data-science"}`))
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "connectionTicket") || strings.Contains(recorder.Body.String(), "ticket") {
		t.Fatalf("response leaked ticket: %s", recorder.Body.String())
	}
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != "__Secure-kernel-ticket" || !cookies[0].HttpOnly || !cookies[0].Secure {
		t.Fatalf("session cookie = %#v", cookies)
	}
	if recorder.Header().Get("Cache-Control") != "no-store" || recorder.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("missing no-store/no-referrer headers")
	}
}
