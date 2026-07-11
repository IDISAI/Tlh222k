// Package config loads kernel-server settings from the environment.
package config

import (
	"os"
	"strings"
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
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
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
		Port:           getenv("PORT", "3006"),
		StorageDir:     getenv("STORAGE_DIR", "./storage/notebooks"),
		DevAuthRole:    os.Getenv("DEV_AUTH_ROLE"),
		ClerkJWKSURL:   os.Getenv("CLERK_JWKS_URL"),
		AllowedOrigins: origins,
	}
}
