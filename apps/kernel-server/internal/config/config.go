// Package config loads kernel-server settings from the environment.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment string
	Port        string
	// Directory holding notebook blobs + metadata (filesystem store v1).
	StorageDir string
	// Dev-only auth bypass: when set (e.g. "super-admin"), every request is
	// treated as that role and JWT verification is skipped. Mirrors the web
	// apps' NEXT_PUBLIC_DEV_AUTH_ROLE. MUST be empty in production.
	DevAuthRole string
	// Clerk JWKS endpoint used to verify session JWTs when DevAuthRole is empty.
	ClerkJWKSURL        string
	ClerkIssuer         string
	ClerkAudience       string
	SessionTicketSecret string
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
		Environment:          strings.ToLower(strings.TrimSpace(getenv("APP_ENV", "production"))),
		Port:                 getenv("PORT", "3006"),
		StorageDir:           getenv("STORAGE_DIR", "./storage/notebooks"),
		DevAuthRole:          os.Getenv("DEV_AUTH_ROLE"),
		ClerkJWKSURL:         os.Getenv("CLERK_JWKS_URL"),
		ClerkIssuer:          os.Getenv("CLERK_ISSUER"),
		ClerkAudience:        os.Getenv("CLERK_AUDIENCE"),
		SessionTicketSecret:  os.Getenv("SESSION_TICKET_SECRET"),
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

func (c Config) Validate() error {
	switch c.Environment {
	case "development", "test", "production":
	default:
		return fmt.Errorf("APP_ENV must be development, test, or production, got %q", c.Environment)
	}
	if c.DevAuthRole != "" {
		role := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(c.DevAuthRole)), "_", "-")
		if role != "viewer" && role != "admin" && role != "super-admin" {
			return fmt.Errorf("DEV_AUTH_ROLE is invalid: %q", c.DevAuthRole)
		}
	}
	if strings.TrimSpace(c.SessionTicketSecret) == "" {
		return errors.New("SESSION_TICKET_SECRET is required")
	}
	if c.Environment != "production" {
		return nil
	}
	if c.DevAuthRole != "" {
		return errors.New("DEV_AUTH_ROLE is forbidden in production")
	}
	for key, value := range map[string]string{
		"CLERK_JWKS_URL": c.ClerkJWKSURL,
		"CLERK_ISSUER":   c.ClerkIssuer,
		"CLERK_AUDIENCE": c.ClerkAudience,
	} {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s is required in production", key)
		}
	}
	if len(c.SessionTicketSecret) < 32 {
		return errors.New("SESSION_TICKET_SECRET must be at least 32 bytes in production")
	}
	for key, value := range map[string]string{
		"CLERK_JWKS_URL": c.ClerkJWKSURL,
		"CLERK_ISSUER":   c.ClerkIssuer,
	} {
		parsed, err := url.Parse(value)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
			return fmt.Errorf("%s must be an absolute HTTPS URL in production", key)
		}
	}
	return nil
}
