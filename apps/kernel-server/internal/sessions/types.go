// Package sessions owns sandbox session lifecycle and authorization boundaries.
package sessions

import (
	"context"
	"errors"
	"time"
)

var (
	ErrCapacity  = errors.New("session capacity reached")
	ErrForbidden = errors.New("session belongs to another owner")
	ErrNotFound  = errors.New("session not found")
)

type Status string

const StatusActive Status = "active"

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
}

type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time { return time.Now() }

type Options struct {
	MaxSessions int
	IdleTimeout time.Duration
	CPU         string
	Memory      string
	Pids        int
	Network     string
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
