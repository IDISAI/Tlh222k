// kernel-server: notebook CRUD (filesystem v1) + Clerk-gated auth + CORS for the
// web / admin zones. Phase 3 adds the Jupyter WebSocket proxy for execution.
package main

import (
	"context"
	"errors"
	"fmt"
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
	"github.com/lh222k/kernel-server/internal/proxy"
	"github.com/lh222k/kernel-server/internal/runtime"
	"github.com/lh222k/kernel-server/internal/sessions"
	"github.com/lh222k/kernel-server/internal/store"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("config: %v", err)
	}
	processCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	fsStore, err := store.NewFSStore(cfg.StorageDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}

	var containerRuntime managedRuntime
	if cfg.JupyterBrokerURL != "" {
		containerRuntime, err = runtime.NewBrokerRuntime(cfg.JupyterBrokerURL, cfg.JupyterBrokerToken, nil)
		if err != nil {
			log.Fatalf("broker runtime: %v", err)
		}
	} else {
		runtimeOptions := []runtime.DockerRuntimeOption{}
		if cfg.JupyterHostProxy {
			runtimeOptions = append(runtimeOptions, runtime.WithHostProxy())
		}
		containerRuntime = runtime.NewDockerRuntime(nil, runtime.DefaultImages(), runtimeOptions...)
	}
	if err := containerRuntime.RemoveStaleContainers(processCtx); err != nil {
		// Keep local notebook editing available when Docker Desktop is stopped.
		// Production has no dev auth bypass, so a missing sandbox runtime remains fatal.
		if cfg.DevAuthRole == "" {
			log.Fatalf("reconcile notebook containers: %v", err)
		}
		log.Printf("sandbox runtime unavailable; notebook execution disabled: %v", err)
	}
	sessionManager := sessions.NewManager(sessions.Options{
		MaxSessions:         cfg.JupyterMaxSessions,
		MaxSessionsPerOwner: cfg.JupyterMaxSessionsPerOwner,
		IdleTimeout:         cfg.JupyterSessionIdle,
		CPU:                 cfg.JupyterSessionCPU,
		Memory:              cfg.JupyterSessionMemory,
		Pids:                cfg.JupyterSessionPIDs,
		Network:             cfg.JupyterDockerNetwork,
	}, containerRuntime, sessions.SystemClock{})
	tickets := proxy.NewTickets([]byte(cfg.SessionTicketSecret), time.Now)
	mux := http.NewServeMux()
	api.NewWithSessions(fsStore, sessionManager, tickets, cfg.AllowedOrigins).Register(mux)

	authn := auth.New(auth.Options{
		DevRole:  cfg.DevAuthRole,
		JWKSURL:  cfg.ClerkJWKSURL,
		Issuer:   cfg.ClerkIssuer,
		Audience: cfg.ClerkAudience,
	})
	handler := httpx.CORS(cfg.AllowedOrigins, authn.Middleware(mux))
	go reapSessions(processCtx, sessionManager)

	if cfg.DevAuthRole != "" {
		log.Printf("⚠ DEV_AUTH_ROLE=%q — auth bypass ON (dev only)", cfg.DevAuthRole)
	}
	log.Printf("kernel-server listening on :%s (storage: %s)", cfg.Port, cfg.StorageDir)
	server := &http.Server{Addr: ":" + cfg.Port, Handler: handler}
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	var serveErr error
	select {
	case <-processCtx.Done():
	case serveErr = <-serverErrors:
	}
	stop()
	if err := shutdownServices(server, sessionManager, 10*time.Second); err != nil {
		log.Printf("graceful shutdown: %v", err)
	}
	if serveErr == nil {
		serveErr = <-serverErrors
	}
	if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		log.Fatal(serveErr)
	}
}

type shutdownServer interface {
	Shutdown(context.Context) error
}

type sessionStopper interface {
	StopAll(context.Context) error
}

type managedRuntime interface {
	sessions.Runtime
	RemoveStaleContainers(context.Context) error
}

func shutdownServices(server shutdownServer, sessions sessionStopper, timeout time.Duration) error {
	httpCtx, cancelHTTP := context.WithTimeout(context.Background(), timeout)
	httpErr := server.Shutdown(httpCtx)
	cancelHTTP()

	cleanupCtx, cancelCleanup := context.WithTimeout(context.Background(), timeout)
	cleanupErr := sessions.StopAll(cleanupCtx)
	cancelCleanup()

	var errs []error
	if httpErr != nil {
		errs = append(errs, fmt.Errorf("server shutdown: %w", httpErr))
	}
	if cleanupErr != nil {
		errs = append(errs, fmt.Errorf("stop notebook sessions: %w", cleanupErr))
	}
	return errors.Join(errs...)
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
