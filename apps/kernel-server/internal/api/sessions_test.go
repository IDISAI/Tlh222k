package api

import (
	"context"
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

func TestCreateSessionReturns429WhenOwnerQuotaIsFull(t *testing.T) {
	manager, _ := routeManager(t, "dev:admin")
	mux := http.NewServeMux()
	NewWithSessions(nil, manager, proxy.NewTickets([]byte("secret"), time.Now), nil).Register(mux)
	handler := auth.New(auth.Options{DevRole: "admin"}).Middleware(mux)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(`{"profile":"ml-cpu"}`))
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", recorder.Code)
	}
}
