package sessions_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/config"
	"github.com/lh222k/kernel-server/internal/sessions"
)

type fakeRuntime struct {
	starts   int
	stops    int
	stopped  []string
	startErr error
	dead     bool
}

func (f *fakeRuntime) Start(context.Context, sessions.StartRequest) (sessions.RuntimeHandle, error) {
	f.starts++
	if f.startErr != nil {
		return sessions.RuntimeHandle{}, f.startErr
	}
	return sessions.RuntimeHandle{ID: fmt.Sprintf("ctr-%d", f.starts), Endpoint: "http://nb-1:8888", Token: "jupyter"}, nil
}

func (f *fakeRuntime) Stop(_ context.Context, containerID string) error {
	f.stops++
	f.stopped = append(f.stopped, containerID)
	return nil
}

func (f *fakeRuntime) Alive(context.Context, string) bool { return !f.dead }

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

func TestResumeReplacesDeadRuntime(t *testing.T) {
	runtime := &fakeRuntime{}
	clock := &fakeClock{now: time.Unix(100, 0)}
	manager := sessions.NewManager(managerOptions(), runtime, clock)

	first, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	runtime.dead = true // container vanished out-of-band
	replacement, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("recreate session: %v", err)
	}
	if replacement.ID == first.ID {
		t.Fatalf("resumed dead session %q, want a fresh one", first.ID)
	}
	if runtime.starts != 2 || !slices.Contains(runtime.stopped, first.Handle.ID) {
		t.Fatalf("starts = %d, stopped = %v; want 2 starts and %q stopped", runtime.starts, runtime.stopped, first.Handle.ID)
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

func TestStopAllStopsEveryActiveRuntime(t *testing.T) {
	runtime := &fakeRuntime{}
	manager := sessions.NewManager(managerOptions(), runtime, &fakeClock{now: time.Unix(100, 0)})

	for _, owner := range []string{"user-1", "user-2"} {
		if _, err := manager.CreateOrResume(context.Background(), owner, "data-science"); err != nil {
			t.Fatalf("create session for %s: %v", owner, err)
		}
	}
	if err := manager.StopAll(context.Background()); err != nil {
		t.Fatalf("stop all: %v", err)
	}
	slices.Sort(runtime.stopped)
	if !slices.Equal(runtime.stopped, []string{"ctr-1", "ctr-2"}) {
		t.Fatalf("stopped containers = %#v, want ctr-1 and ctr-2", runtime.stopped)
	}
}

func TestDevAuthenticatorSetsAuthenticatedPrincipal(t *testing.T) {
	authenticator := auth.New(auth.Options{DevRole: "admin"})
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
		"JUPYTER_MAX_SESSIONS", "JUPYTER_MAX_SESSIONS_PER_OWNER", "JUPYTER_SESSION_IDLE_SECONDS", "JUPYTER_SESSION_CPU",
		"JUPYTER_SESSION_MEMORY", "JUPYTER_SESSION_PIDS", "JUPYTER_DOCKER_NETWORK",
	} {
		t.Setenv(key, "")
	}
	cfg := config.Load()

	if cfg.JupyterMaxSessions != 2 || cfg.JupyterMaxSessionsPerOwner != 1 || cfg.JupyterSessionIdle != 15*time.Minute {
		t.Fatalf("session limits = %d/%d/%s, want 2/1/15m", cfg.JupyterMaxSessions, cfg.JupyterMaxSessionsPerOwner, cfg.JupyterSessionIdle)
	}
	if cfg.JupyterSessionCPU != "1" || cfg.JupyterSessionMemory != "2g" || cfg.JupyterSessionPIDs != 128 {
		t.Fatalf("runtime limits = %q/%q/%d, want 1/2g/128", cfg.JupyterSessionCPU, cfg.JupyterSessionMemory, cfg.JupyterSessionPIDs)
	}
	if cfg.JupyterDockerNetwork != "notebook-internal" {
		t.Fatalf("docker network = %q, want notebook-internal", cfg.JupyterDockerNetwork)
	}
}

type blockingRuntime struct {
	mu           sync.Mutex
	starts       int
	stops        int
	startEntered chan struct{}
	releaseStart <-chan struct{}
}

func (r *blockingRuntime) Start(_ context.Context, _ sessions.StartRequest) (sessions.RuntimeHandle, error) {
	r.mu.Lock()
	r.starts++
	startNumber := r.starts
	entered := r.startEntered
	release := r.releaseStart
	r.mu.Unlock()
	if entered != nil {
		entered <- struct{}{}
	}
	if release != nil {
		<-release
	}
	return sessions.RuntimeHandle{
		ID:       fmt.Sprintf("ctr-%d", startNumber),
		Endpoint: "http://notebook:8888",
		Token:    "jupyter",
	}, nil
}

func (r *blockingRuntime) Stop(context.Context, string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stops++
	return nil
}

func (r *blockingRuntime) Alive(context.Context, string) bool { return true }

func (r *blockingRuntime) startCount() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.starts
}

func TestSlowStartDoesNotBlockExistingSessionTouch(t *testing.T) {
	runtime := &blockingRuntime{}
	options := managerOptions()
	options.MaxSessionsPerOwner = 1
	manager := sessions.NewManager(options, runtime, &fakeClock{now: time.Unix(100, 0)})
	existing, err := manager.CreateOrResume(context.Background(), "user-1", "data-science")
	if err != nil {
		t.Fatalf("create existing session: %v", err)
	}

	entered := make(chan struct{}, 1)
	release := make(chan struct{})
	runtime.mu.Lock()
	runtime.startEntered = entered
	runtime.releaseStart = release
	runtime.mu.Unlock()
	createDone := make(chan error, 1)
	go func() {
		_, err := manager.CreateOrResume(context.Background(), "user-2", "data-science")
		createDone <- err
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("slow runtime start was not reached")
	}

	touchDone := make(chan error, 1)
	go func() { touchDone <- manager.Touch("user-1", existing.ID) }()
	select {
	case err := <-touchDone:
		if err != nil {
			t.Fatalf("touch existing session: %v", err)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Touch blocked behind unrelated runtime.Start")
	}
	close(release)
	if err := <-createDone; err != nil {
		t.Fatalf("create slow session: %v", err)
	}
}

func TestConcurrentStartsReserveGlobalCapacity(t *testing.T) {
	entered := make(chan struct{}, 8)
	release := make(chan struct{})
	runtime := &blockingRuntime{startEntered: entered, releaseStart: release}
	options := managerOptions()
	options.MaxSessions = 2
	options.MaxSessionsPerOwner = 1
	manager := sessions.NewManager(options, runtime, &fakeClock{now: time.Unix(100, 0)})

	start := make(chan struct{})
	results := make(chan error, 6)
	for i := 0; i < 6; i++ {
		go func(index int) {
			<-start
			_, err := manager.CreateOrResume(context.Background(), fmt.Sprintf("user-%d", index), "data-science")
			results <- err
		}(i)
	}
	close(start)
	for i := 0; i < 2; i++ {
		select {
		case <-entered:
		case <-time.After(time.Second):
			t.Fatal("capacity reservations serialized or lost a permitted start")
		}
	}
	select {
	case <-entered:
		t.Fatal("runtime.Start exceeded global capacity")
	case <-time.After(50 * time.Millisecond):
	}
	close(release)

	successes := 0
	capacityErrors := 0
	for i := 0; i < 6; i++ {
		err := <-results
		switch {
		case err == nil:
			successes++
		case errors.Is(err, sessions.ErrCapacity):
			capacityErrors++
		default:
			t.Fatalf("unexpected create error: %v", err)
		}
	}
	if successes != 2 || capacityErrors != 4 || runtime.startCount() != 2 {
		t.Fatalf("success/capacity/start = %d/%d/%d, want 2/4/2", successes, capacityErrors, runtime.startCount())
	}
}

func TestPerOwnerQuotaRejectsSecondProfileWithoutStartingRuntime(t *testing.T) {
	runtime := &blockingRuntime{}
	options := managerOptions()
	options.MaxSessionsPerOwner = 1
	manager := sessions.NewManager(options, runtime, &fakeClock{now: time.Unix(100, 0)})
	if _, err := manager.CreateOrResume(context.Background(), "user-1", "data-science"); err != nil {
		t.Fatalf("create first profile: %v", err)
	}
	if _, err := manager.CreateOrResume(context.Background(), "user-1", "ml-cpu"); !errors.Is(err, sessions.ErrOwnerCapacity) {
		t.Fatalf("second owner profile error = %v, want ErrOwnerCapacity", err)
	}
	if runtime.startCount() != 1 {
		t.Fatalf("runtime starts = %d, want 1", runtime.startCount())
	}
}
