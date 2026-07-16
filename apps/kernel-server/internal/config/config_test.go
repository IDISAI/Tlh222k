package config

import (
	"strings"
	"testing"
)

func TestLoadDefaultsToProduction(t *testing.T) {
	for _, key := range []string{
		"APP_ENV", "DEV_AUTH_ROLE", "CLERK_JWKS_URL", "CLERK_ISSUER",
		"CLERK_AUDIENCE", "SESSION_TICKET_SECRET",
	} {
		t.Setenv(key, "")
	}

	cfg := Load()
	if cfg.Environment != "production" {
		t.Fatalf("Environment = %q, want production", cfg.Environment)
	}
}

func TestValidateRejectsProductionDevBypass(t *testing.T) {
	cfg := validProductionConfig()
	cfg.DevAuthRole = "super-admin"

	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "DEV_AUTH_ROLE") {
		t.Fatalf("Validate error = %v, want DEV_AUTH_ROLE rejection", err)
	}
}

func TestValidateRequiresProductionJWTConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*Config)
		field  string
	}{
		{name: "JWKS URL", mutate: func(c *Config) { c.ClerkJWKSURL = "" }, field: "CLERK_JWKS_URL"},
		{name: "issuer", mutate: func(c *Config) { c.ClerkIssuer = "" }, field: "CLERK_ISSUER"},
		{name: "audience", mutate: func(c *Config) { c.ClerkAudience = "" }, field: "CLERK_AUDIENCE"},
		{name: "ticket secret", mutate: func(c *Config) { c.SessionTicketSecret = "short" }, field: "SESSION_TICKET_SECRET"},
		{name: "broker URL", mutate: func(c *Config) { c.JupyterBrokerURL = "" }, field: "JUPYTER_BROKER_URL"},
		{name: "broker token", mutate: func(c *Config) { c.JupyterBrokerToken = "short" }, field: "JUPYTER_BROKER_TOKEN"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := validProductionConfig()
			test.mutate(&cfg)
			if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), test.field) {
				t.Fatalf("Validate error = %v, want field %s", err, test.field)
			}
		})
	}
}

func TestValidateAcceptsExplicitDevelopmentBypass(t *testing.T) {
	cfg := Config{
		Environment:         "development",
		DevAuthRole:         "super-admin",
		SessionTicketSecret: "development-only-ticket-secret",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate development config: %v", err)
	}
}

func TestValidateRejectsUnknownEnvironmentAndRole(t *testing.T) {
	cfg := validProductionConfig()
	cfg.Environment = "prod"
	if err := cfg.Validate(); err == nil {
		t.Fatal("unknown APP_ENV was accepted")
	}

	cfg = validProductionConfig()
	cfg.Environment = "development"
	cfg.DevAuthRole = "root"
	if err := cfg.Validate(); err == nil {
		t.Fatal("unknown DEV_AUTH_ROLE was accepted")
	}
}

func validProductionConfig() Config {
	return Config{
		Environment:         "production",
		ClerkJWKSURL:        "https://clerk.example/.well-known/jwks.json",
		ClerkIssuer:         "https://clerk.example",
		ClerkAudience:       "kernel-server",
		SessionTicketSecret: "0123456789abcdef0123456789abcdef",
		JupyterBrokerURL:    "http://docker-broker:3007",
		JupyterBrokerToken:  "abcdef0123456789abcdef0123456789",
	}
}
