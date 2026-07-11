// kernel-server: notebook CRUD (filesystem v1) + Clerk-gated auth + CORS for the
// web / admin zones. Phase 3 adds the Jupyter WebSocket proxy for execution.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/lh222k/kernel-server/internal/api"
	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/config"
	"github.com/lh222k/kernel-server/internal/httpx"
	"github.com/lh222k/kernel-server/internal/sessions"
	"github.com/lh222k/kernel-server/internal/store"
)

func main() {
	cfg := config.Load()
	processCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	fsStore, err := store.NewFSStore(cfg.StorageDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}

	mux := http.NewServeMux()
	api.New(fsStore).Register(mux)

	authn := auth.New(cfg.DevAuthRole, cfg.ClerkJWKSURL)
	handler := httpx.CORS(cfg.AllowedOrigins, authn.Middleware(mux))
	sessionManager := sessions.NewManager(sessions.Options{
		MaxSessions: cfg.JupyterMaxSessions,
		IdleTimeout: cfg.JupyterSessionIdle,
		CPU:         cfg.JupyterSessionCPU,
		Memory:      cfg.JupyterSessionMemory,
		Pids:        cfg.JupyterSessionPIDs,
		Network:     cfg.JupyterDockerNetwork,
	}, nil, sessions.SystemClock{})
	go reapSessions(processCtx, sessionManager)

	if cfg.DevAuthRole != "" {
		log.Printf("⚠ DEV_AUTH_ROLE=%q — auth bypass ON (dev only)", cfg.DevAuthRole)
	}
	log.Printf("kernel-server listening on :%s (storage: %s)", cfg.Port, cfg.StorageDir)
	server := &http.Server{Addr: ":" + cfg.Port, Handler: handler}
	go func() {
		<-processCtx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("server shutdown: %v", err)
		}
	}()
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func reapSessions(ctx context.Context, manager *sessions.Manager) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := manager.ReapExpired(ctx); err != nil {
				log.Printf("reap sessions: %v", err)
			}
		}
	}
}
