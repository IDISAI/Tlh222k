// Package sessions owns sandbox session lifecycle and authorization boundaries.
package sessions

import (
	"context"
	"errors"
	"time"
)

var (
	ErrCapacity      = errors.New("session capacity reached")
	ErrOwnerCapacity = errors.New("owner session capacity reached")
	ErrForbidden     = errors.New("session belongs to another owner")
	ErrNotFound      = errors.New("session not found")
	ErrShuttingDown  = errors.New("session manager is shutting down")
)

type Status string

const (
	StatusActive   Status = "active"
	StatusStopping Status = "stopping"
)

type RuntimeHandle struct {
	ID       string
	Endpoint string
	Token    string
}

type StartRequest struct {
	SessionID string
	Profile   string
	CPU       string
	Memory    string
	Pids      int
	Network   string
}

type Runtime interface {
	Start(context.Context, StartRequest) (RuntimeHandle, error)
	Stop(context.Context, string) error
	// Alive reports whether the container behind a handle is still running.
	// Containers can vanish out-of-band (docker restart, OOM kill, interrupted
	// delete) — resuming such a session would 502 forever.
	Alive(context.Context, string) bool
}

type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time { return time.Now() }

type Options struct {
	MaxSessions         int
	MaxSessionsPerOwner int
	IdleTimeout         time.Duration
	CPU                 string
	Memory              string
	Pids                int
	Network             string
}

type Session struct {
	ID           string
	Owner        string
	Profile      string
	Handle       RuntimeHandle
	LastActivity time.Time
	ExpiresAt    time.Time
	Status       Status
}
