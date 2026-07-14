// Package config loads kernel-server settings from the environment.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port string
	// Directory holding notebook blobs + metadata (filesystem store v1).
	StorageDir string
	// Dev-only auth bypass: when set (e.g. "super-admin"), every request is
	// treated as that role and JWT verification is skipped. Mirrors the web
	// apps' NEXT_PUBLIC_DEV_AUTH_ROLE. MUST be empty in production.
	DevAuthRole string
	// Clerk JWKS endpoint used to verify session JWTs when DevAuthRole is empty.
	ClerkJWKSURL string
	// Browser origins allowed to call this server (CORS).
	AllowedOrigins []string

	JupyterMaxSessions   int
	JupyterSessionIdle   time.Duration
	JupyterSessionCPU    string
	JupyterSessionMemory string
	JupyterSessionPIDs   int
	JupyterDockerNetwork string
	// Publish runtime containers on host loopback instead of joining the Docker
	// network. Only for kernel-server running directly on the host (local dev);
	// containerized kernel-server must leave this unset.
	JupyterHostProxy bool
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvPositiveInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func Load() Config {
	origins := strings.Split(
		getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3002,http://localhost:3003"),
		",",
	)
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return Config{
		Port:                 getenv("PORT", "3006"),
		StorageDir:           getenv("STORAGE_DIR", "./storage/notebooks"),
		DevAuthRole:          os.Getenv("DEV_AUTH_ROLE"),
		ClerkJWKSURL:         os.Getenv("CLERK_JWKS_URL"),
		AllowedOrigins:       origins,
		JupyterMaxSessions:   getenvPositiveInt("JUPYTER_MAX_SESSIONS", 2),
		JupyterSessionIdle:   time.Duration(getenvPositiveInt("JUPYTER_SESSION_IDLE_SECONDS", 900)) * time.Second,
		JupyterSessionCPU:    getenv("JUPYTER_SESSION_CPU", "1"),
		JupyterSessionMemory: getenv("JUPYTER_SESSION_MEMORY", "2g"),
		JupyterSessionPIDs:   getenvPositiveInt("JUPYTER_SESSION_PIDS", 128),
		JupyterDockerNetwork: getenv("JUPYTER_DOCKER_NETWORK", "notebook-internal"),
		JupyterHostProxy:     os.Getenv("JUPYTER_HOST_PROXY") == "1",
	}
}
