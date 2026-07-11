package sessions_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/config"
	"github.com/lh222k/kernel-server/internal/sessions"
)

type fakeRuntime struct {
	starts   int
	stops    int
	startErr error
}

func (f *fakeRuntime) Start(context.Context, sessions.StartRequest) (sessions.RuntimeHandle, error) {
	f.starts++
	if f.startErr != nil {
		return sessions.RuntimeHandle{}, f.startErr
	}
	return sessions.RuntimeHandle{ID: "ctr-1", Endpoint: "http://nb-1:8888", Token: "jupyter"}, nil
}

func (f *fakeRuntime) Stop(context.Context, string) error {
	f.stops++
	return nil
}

type fakeClock struct{ now time.Time }

func (f *fakeClock) Now() time.Time { return f.now }

func managerOptions() sessions.Options {
	return sessions.Options{
		MaxSessions: 2,
		IdleTimeout: 15 * time.Minute,
		CPU:         "1",
		Memory:      "2g",
		Pids:        128,
		Network:     "notebook-internal",
	}
}

func TestCreateRejectsThirdActiveSession(t *testing.T) {
	runtime := &fakeRuntime{}
	manager := sessions.NewManager(managerOptions(), runtime, &fakeClock{now: time.Unix(100, 0)})

	for _, owner := range []string{"user-1", "user-2"} {
		if _, err := manager.CreateOrResume(context.Background(), owner, "data-science"); err != nil {
			t.Fatalf("create session for %s: %v", owner, err)
		}
	}
	if _, err := manager.CreateOrResume(context.Background(), "user-3", "data-science"); !errors.Is(err, sessions.ErrCapacity) {
		t.Fatalf("create third session error = %v, want ErrCapacity", err)
	}
	if runtime.starts != 2 {
		t.Fatalf("runtime starts = %d, want 2", runtime.starts)
	}
}

func TestCreateResumesSameOwnerAndProfile(t *testing.T) {
	runtime := &fakeRuntime{}
	clock := &fakeClock{now: time.Unix(100, 0)}
	manager := sessions.NewManager(managerOptions(), runtime, clock)

	first, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	clock.now = clock.now.Add(time.Minute)
	resumed, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("resume session: %v", err)
	}
	if resumed.ID != first.ID || runtime.starts != 1 {
		t.Fatalf("resumed ID/starts = %q/%d, want %q/1", resumed.ID, runtime.starts, first.ID)
	}
}

func TestGetRejectsDifferentOwner(t *testing.T) {
	manager := sessions.NewManager(managerOptions(), &fakeRuntime{}, &fakeClock{now: time.Unix(100, 0)})
	session, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := manager.Get("user-2", session.ID); !errors.Is(err, sessions.ErrForbidden) {
		t.Fatalf("get as different owner error = %v, want ErrForbidden", err)
	}
}

func TestFailedStartDoesNotReserveCapacity(t *testing.T) {
	runtime := &fakeRuntime{startErr: errors.New("start failed")}
	manager := sessions.NewManager(managerOptions(), runtime, &fakeClock{now: time.Unix(100, 0)})

	if _, err := manager.CreateOrResume(context.Background(), "user-1", "data-science"); err == nil {
		t.Fatal("create session succeeded, want runtime error")
	}
	runtime.startErr = nil
	if _, err := manager.CreateOrResume(context.Background(), "user-1", "data-science"); err != nil {
		t.Fatalf("create after failed start: %v", err)
	}
}

func TestReapIdleStopsRuntime(t *testing.T) {
	runtime := &fakeRuntime{}
	clock := &fakeClock{now: time.Unix(100, 0)}
	manager := sessions.NewManager(managerOptions(), runtime, clock)
	session, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	clock.now = clock.now.Add(16 * time.Minute)
	if err := manager.ReapExpired(context.Background()); err != nil {
		t.Fatalf("reap expired: %v", err)
	}
	if runtime.stops != 1 {
		t.Fatalf("runtime stops = %d, want 1", runtime.stops)
	}
	if _, err := manager.Get("user-1", session.ID); !errors.Is(err, sessions.ErrNotFound) {
		t.Fatalf("get reaped session error = %v, want ErrNotFound", err)
	}
	if err := manager.ReapExpired(context.Background()); err != nil || runtime.stops != 1 {
		t.Fatalf("second reap error/stops = %v/%d, want nil/1", err, runtime.stops)
	}
}

func TestDevAuthenticatorSetsAuthenticatedPrincipal(t *testing.T) {
	authenticator := auth.New("admin", "")
	var got auth.Principal
	handler := authenticator.Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = auth.PrincipalFrom(r)
	}))
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if got.Subject != "dev:admin" || got.Role != auth.RoleAdmin || !got.Authenticated {
		t.Fatalf("principal = %+v, want authenticated dev admin", got)
	}
}

func TestRequireAuthenticatedRejectsMissingPrincipal(t *testing.T) {
	called := false
	handler := auth.RequireAuthenticated(func(http.ResponseWriter, *http.Request) { called = true })
	recorder := httptest.NewRecorder()
	handler(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusUnauthorized || called {
		t.Fatalf("status/called = %d/%v, want 401/false", recorder.Code, called)
	}
}

func TestConfigSessionDefaults(t *testing.T) {
	for _, key := range []string{
		"JUPYTER_MAX_SESSIONS", "JUPYTER_SESSION_IDLE_SECONDS", "JUPYTER_SESSION_CPU",
		"JUPYTER_SESSION_MEMORY", "JUPYTER_SESSION_PIDS", "JUPYTER_DOCKER_NETWORK",
	} {
		t.Setenv(key, "")
	}
	cfg := config.Load()

	if cfg.JupyterMaxSessions != 2 || cfg.JupyterSessionIdle != 15*time.Minute {
		t.Fatalf("session limits = %d/%s, want 2/15m", cfg.JupyterMaxSessions, cfg.JupyterSessionIdle)
	}
	if cfg.JupyterSessionCPU != "1" || cfg.JupyterSessionMemory != "2g" || cfg.JupyterSessionPIDs != 128 {
		t.Fatalf("runtime limits = %q/%q/%d, want 1/2g/128", cfg.JupyterSessionCPU, cfg.JupyterSessionMemory, cfg.JupyterSessionPIDs)
	}
	if cfg.JupyterDockerNetwork != "notebook-internal" {
		t.Fatalf("docker network = %q, want notebook-internal", cfg.JupyterDockerNetwork)
	}
}
