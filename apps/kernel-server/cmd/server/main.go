// kernel-server: notebook CRUD (filesystem v1) + Clerk-gated auth + CORS for the
// web / admin zones. Phase 3 adds the Jupyter WebSocket proxy for execution.
package main

import (
	"log"
	"net/http"

	"github.com/lh222k/kernel-server/internal/api"
	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/config"
	"github.com/lh222k/kernel-server/internal/httpx"
	"github.com/lh222k/kernel-server/internal/store"
)

func main() {
	cfg := config.Load()

	fsStore, err := store.NewFSStore(cfg.StorageDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}

	mux := http.NewServeMux()
	api.New(fsStore).Register(mux)

	authn := auth.New(cfg.DevAuthRole, cfg.ClerkJWKSURL)
	handler := httpx.CORS(cfg.AllowedOrigins, authn.Middleware(mux))

	if cfg.DevAuthRole != "" {
		log.Printf("⚠ DEV_AUTH_ROLE=%q — auth bypass ON (dev only)", cfg.DevAuthRole)
	}
	log.Printf("kernel-server listening on :%s (storage: %s)", cfg.Port, cfg.StorageDir)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatal(err)
	}
}
