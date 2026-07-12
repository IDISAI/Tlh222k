package api

import (
	"context"
	"net/http"
	"net/http/httptest"
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
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now)).Register(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/sessions/"+session.ID, nil))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
}

func TestSessionRouteReturns403ForDifferentOwner(t *testing.T) {
	manager, session := routeManager(t, "different-owner")
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now)).Register(mux)
	handler := auth.New("admin", "").Middleware(mux)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/sessions/"+session.ID, nil))

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", recorder.Code)
	}
}
