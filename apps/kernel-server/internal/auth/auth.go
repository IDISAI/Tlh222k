// Package auth resolves the caller's principal for each request. Two modes:
//   - Dev bypass: DEV_AUTH_ROLE set → every request is that role (no JWT).
//   - Production: verify the Clerk session JWT (RS256) against the Clerk JWKS
//     and read the role from the token claims.
//
// Only admin / super-admin may create or mutate notebooks; everyone may read a
// published notebook. Real kernel execution (Phase 3) reuses RequireAdmin.
package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Role string

const (
	RoleViewer     Role = "viewer"
	RoleAdmin      Role = "admin"
	RoleSuperAdmin Role = "super-admin"
)

func (r Role) IsAdmin() bool { return r == RoleAdmin || r == RoleSuperAdmin }

type Principal struct {
	Subject       string
	Role          Role
	Authenticated bool
}

type ctxKey struct{}

// Authenticator resolves roles; safe for concurrent use.
type Authenticator struct {
	devRole    Role
	jwksURL    string
	issuer     string
	audience   string
	httpClient *http.Client
	now        func() time.Time

	mu                 sync.RWMutex
	keys               map[string]*rsa.PublicKey
	fetched            time.Time
	lastRefreshAttempt time.Time
	refreshMu          sync.Mutex
}

const (
	jwksCacheTTL        = time.Hour
	jwksRefreshThrottle = 30 * time.Second
	maxJWKSBodyBytes    = 1 << 20
)

type Options struct {
	DevRole    string
	JWKSURL    string
	Issuer     string
	Audience   string
	HTTPClient *http.Client
	Now        func() time.Time
}

func New(options Options) *Authenticator {
	httpClient := options.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 5 * time.Second}
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}
	return &Authenticator{
		devRole:    normalizeRole(options.DevRole),
		jwksURL:    options.JWKSURL,
		issuer:     options.Issuer,
		audience:   options.Audience,
		httpClient: httpClient,
		now:        now,
		keys:       map[string]*rsa.PublicKey{},
	}
}

// Middleware resolves the principal once and stashes it on the request context.
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal := a.resolve(r)
		ctx := context.WithValue(r.Context(), ctxKey{}, principal)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func PrincipalFrom(r *http.Request) Principal {
	if v, ok := r.Context().Value(ctxKey{}).(Principal); ok {
		return v
	}
	return Principal{Role: RoleViewer}
}

func RoleFrom(r *http.Request) Role { return PrincipalFrom(r).Role }

// RequireAuthenticated rejects callers without a verified subject with 401.
func RequireAuthenticated(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !PrincipalFrom(r).Authenticated {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// RequireAdmin rejects non-admin callers with 403.
func RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !RoleFrom(r).IsAdmin() {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

func (a *Authenticator) resolve(r *http.Request) Principal {
	if a.devRole != "" {
		return Principal{Subject: "dev:" + string(a.devRole), Role: a.devRole, Authenticated: true}
	}
	token := bearer(r)
	if token == "" || a.jwksURL == "" {
		return Principal{Role: RoleViewer}
	}
	claims, err := a.verify(token)
	if err != nil {
		return Principal{Role: RoleViewer}
	}
	subject, ok := claims["sub"].(string)
	if !ok || strings.TrimSpace(subject) == "" {
		return Principal{Role: RoleViewer}
	}
	return Principal{Subject: subject, Role: roleFromClaims(claims), Authenticated: true}
}

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if after, ok := strings.CutPrefix(h, "Bearer "); ok {
		return strings.TrimSpace(after)
	}
	return ""
}

// ── JWT (RS256) verification against the Clerk JWKS ─────────────────────────

func (a *Authenticator) verify(token string) (map[string]any, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("malformed jwt")
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(headerBytes, &header) != nil {
		return nil, errors.New("bad jwt header")
	}
	if header.Alg != "RS256" {
		return nil, errors.New("unexpected alg")
	}
	if strings.TrimSpace(header.Kid) == "" {
		return nil, errors.New("missing signing key id")
	}
	key, err := a.key(header.Kid)
	if err != nil {
		return nil, err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("bad signature encoding")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], sig); err != nil {
		return nil, errors.New("signature verification failed")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("bad payload encoding")
	}
	var claims map[string]any
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}
	now := a.now().Unix()
	exp, ok := numericDate(claims["exp"])
	if !ok || now >= exp {
		return nil, errors.New("token expired or missing exp")
	}
	if rawNBF, exists := claims["nbf"]; exists {
		nbf, ok := numericDate(rawNBF)
		if !ok || now < nbf {
			return nil, errors.New("token not active")
		}
	}
	if a.issuer != "" {
		issuer, ok := claims["iss"].(string)
		if !ok || issuer != a.issuer {
			return nil, errors.New("unexpected issuer")
		}
	}
	if a.audience != "" && !claimAudienceContains(claims["aud"], a.audience) {
		return nil, errors.New("unexpected audience")
	}
	return claims, nil
}

func numericDate(value any) (int64, bool) {
	number, ok := value.(float64)
	if !ok || number <= 0 {
		return 0, false
	}
	return int64(number), true
}

func claimAudienceContains(value any, expected string) bool {
	switch audience := value.(type) {
	case string:
		return audience == expected
	case []any:
		for _, item := range audience {
			if value, ok := item.(string); ok && value == expected {
				return true
			}
		}
	case []string:
		for _, value := range audience {
			if value == expected {
				return true
			}
		}
	}
	return false
}

func (a *Authenticator) key(kid string) (*rsa.PublicKey, error) {
	a.mu.RLock()
	key, ok := a.keys[kid]
	fresh := a.now().Sub(a.fetched) < jwksCacheTTL
	a.mu.RUnlock()
	if ok && fresh {
		return key, nil
	}
	if err := a.refreshKeys(); err != nil {
		return nil, err
	}
	a.mu.RLock()
	defer a.mu.RUnlock()
	if key, ok := a.keys[kid]; ok {
		return key, nil
	}
	return nil, errors.New("unknown signing key")
}

func (a *Authenticator) refreshKeys() error {
	a.refreshMu.Lock()
	defer a.refreshMu.Unlock()

	now := a.now()
	a.mu.RLock()
	lastAttempt := a.lastRefreshAttempt
	a.mu.RUnlock()
	if !lastAttempt.IsZero() && now.Sub(lastAttempt) < jwksRefreshThrottle {
		return nil
	}
	a.mu.Lock()
	a.lastRefreshAttempt = now
	a.mu.Unlock()

	if strings.TrimSpace(a.jwksURL) == "" {
		return errors.New("JWKS URL is required")
	}
	request, err := http.NewRequest(http.MethodGet, a.jwksURL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	resp, err := a.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxJWKSBodyBytes+1))
	if err != nil {
		return err
	}
	if len(body) > maxJWKSBodyBytes {
		return errors.New("JWKS response too large")
	}
	var jwks struct {
		Keys []struct {
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.Unmarshal(body, &jwks); err != nil {
		return err
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range jwks.Keys {
		if strings.TrimSpace(k.Kid) == "" || (k.Kty != "" && k.Kty != "RSA") || (k.Alg != "" && k.Alg != "RS256") {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
			continue
		}
		exponent := new(big.Int).SetBytes(eBytes)
		if !exponent.IsInt64() {
			continue
		}
		e := int(exponent.Int64())
		if e < 3 || e%2 == 0 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: e,
		}
	}
	if len(keys) == 0 {
		return errors.New("JWKS contains no valid RSA signing keys")
	}
	a.mu.Lock()
	a.keys = keys
	a.fetched = now
	a.mu.Unlock()
	return nil
}

// roleFromClaims reads role from Clerk's `metadata.role` or `publicMetadata.role`
// and normalizes it (matches the web apps' getRole()).
func roleFromClaims(claims map[string]any) Role {
	for _, key := range []string{"metadata", "publicMetadata"} {
		if m, ok := claims[key].(map[string]any); ok {
			if role, ok := m["role"].(string); ok {
				return normalizeRole(role)
			}
		}
	}
	return RoleViewer
}

func normalizeRole(raw string) Role {
	r := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(raw)), "_", "-")
	switch r {
	case "admin":
		return RoleAdmin
	case "super-admin":
		return RoleSuperAdmin
	case "viewer":
		return RoleViewer
	default:
		return Role(r)
	}
}
