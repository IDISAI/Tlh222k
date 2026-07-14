// Package runtime starts and stops isolated notebook runtimes.
package runtime

import (
	"context"

	"github.com/lh222k/kernel-server/internal/sessions"
)

type Runtime interface {
	Start(ctx context.Context, request sessions.StartRequest) (sessions.RuntimeHandle, error)
	Stop(ctx context.Context, containerID string) error
	Alive(ctx context.Context, containerID string) bool
}
