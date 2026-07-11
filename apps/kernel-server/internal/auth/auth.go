// Package auth resolves the caller's role for each request. Two modes:
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

type ctxKey struct{}

// Authenticator resolves roles; safe for concurrent use.
type Authenticator struct {
	devRole Role
	jwksURL string

	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

func New(devAuthRole, jwksURL string) *Authenticator {
	return &Authenticator{
		devRole: normalizeRole(devAuthRole),
		jwksURL: jwksURL,
		keys:    map[string]*rsa.PublicKey{},
	}
}

// Middleware resolves the role once and stashes it on the request context.
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := a.resolve(r)
		ctx := context.WithValue(r.Context(), ctxKey{}, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RoleFrom(r *http.Request) Role {
	if v, ok := r.Context().Value(ctxKey{}).(Role); ok {
		return v
	}
	return RoleViewer
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

func (a *Authenticator) resolve(r *http.Request) Role {
	if a.devRole != "" {
		return a.devRole
	}
	token := bearer(r)
	if token == "" || a.jwksURL == "" {
		return RoleViewer
	}
	claims, err := a.verify(token)
	if err != nil {
		return RoleViewer
	}
	return roleFromClaims(claims)
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
	// Reject expired tokens.
	if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
		return nil, errors.New("token expired")
	}
	return claims, nil
}

func (a *Authenticator) key(kid string) (*rsa.PublicKey, error) {
	a.mu.RLock()
	key, ok := a.keys[kid]
	fresh := time.Since(a.fetched) < time.Hour
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
	resp, err := http.Get(a.jwksURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return err
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: int(new(big.Int).SetBytes(eBytes).Int64()),
		}
	}
	a.mu.Lock()
	a.keys = keys
	a.fetched = time.Now()
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
