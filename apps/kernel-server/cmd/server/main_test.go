package main

import (
	"context"
	"slices"
	"testing"
	"time"
)

type deadlineShutdownServer struct {
	events chan<- string
}

func (s deadlineShutdownServer) Shutdown(ctx context.Context) error {
	s.events <- "http"
	<-ctx.Done()
	return ctx.Err()
}

type blockingSessionStopper struct {
	events  chan<- string
	ctxErr  chan<- error
	started chan struct{}
	release <-chan struct{}
}

func (s blockingSessionStopper) StopAll(ctx context.Context) error {
	s.events <- "sessions"
	s.ctxErr <- ctx.Err()
	close(s.started)
	<-s.release
	return nil
}

func TestShutdownServicesWaitsForSessionCleanupWithFreshTimeout(t *testing.T) {
	events := make(chan string, 2)
	cleanupContextErr := make(chan error, 1)
	cleanupStarted := make(chan struct{})
	cleanupRelease := make(chan struct{})
	result := make(chan error, 1)

	go func() {
		result <- shutdownServices(
			deadlineShutdownServer{events: events},
			blockingSessionStopper{
				events:  events,
				ctxErr:  cleanupContextErr,
				started: cleanupStarted,
				release: cleanupRelease,
			},
			10*time.Millisecond,
		)
	}()

	select {
	case <-cleanupStarted:
	case <-time.After(time.Second):
		t.Fatal("session cleanup did not start")
	}
	if err := <-cleanupContextErr; err != nil {
		t.Fatalf("session cleanup context already expired: %v", err)
	}
	if got := []string{<-events, <-events}; !slices.Equal(got, []string{"http", "sessions"}) {
		t.Fatalf("shutdown order = %#v, want HTTP then sessions", got)
	}
	select {
	case err := <-result:
		t.Fatalf("shutdown returned before session cleanup completed: %v", err)
	default:
	}

	close(cleanupRelease)
	select {
	case <-result:
	case <-time.After(time.Second):
		t.Fatal("shutdown did not return after session cleanup completed")
	}
}
