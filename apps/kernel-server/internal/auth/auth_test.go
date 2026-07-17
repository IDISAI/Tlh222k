package auth

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestVerifyRejectsMissingExpiration(t *testing.T) {
	a, privateKey := testAuthenticator(t, "key-1")
	token := signTestToken(t, privateKey, "key-1", map[string]any{
		"sub": "user-1",
	})

	if _, err := a.verify(token); err == nil {
		t.Fatal("token without exp was accepted")
	}
}

func TestVerifyRejectsFutureNotBefore(t *testing.T) {
	a, privateKey := testAuthenticator(t, "key-1")
	token := signTestToken(t, privateKey, "key-1", map[string]any{
		"sub": "user-1",
		"exp": time.Now().Add(time.Hour).Unix(),
		"nbf": time.Now().Add(10 * time.Minute).Unix(),
	})

	if _, err := a.verify(token); err == nil {
		t.Fatal("token before nbf was accepted")
	}
}

func TestVerifyRejectsEmptyKeyID(t *testing.T) {
	a, privateKey := testAuthenticator(t, "")
	token := signTestToken(t, privateKey, "", map[string]any{
		"sub": "user-1",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	if _, err := a.verify(token); err == nil {
		t.Fatal("token without kid was accepted")
	}
}

func TestVerifyEnforcesIssuerAndAudience(t *testing.T) {
	now := time.Unix(10_000, 0)
	privateKey, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	a := New(Options{
		Issuer:   "https://clerk.example",
		Audience: "kernel-server",
		Now:      func() time.Time { return now },
	})
	a.keys["key-1"] = &privateKey.PublicKey
	a.fetched = now

	tests := []struct {
		name     string
		issuer   string
		audience any
		wantOK   bool
	}{
		{name: "valid string audience", issuer: "https://clerk.example", audience: "kernel-server", wantOK: true},
		{name: "valid audience array", issuer: "https://clerk.example", audience: []string{"other", "kernel-server"}, wantOK: true},
		{name: "wrong issuer", issuer: "https://attacker.example", audience: "kernel-server"},
		{name: "wrong audience", issuer: "https://clerk.example", audience: "other-service"},
		{name: "missing audience", issuer: "https://clerk.example", audience: nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			claims := map[string]any{
				"sub": "user-1",
				"exp": now.Add(time.Hour).Unix(),
				"iss": test.issuer,
			}
			if test.audience != nil {
				claims["aud"] = test.audience
			}
			token := signTestToken(t, privateKey, "key-1", claims)
			_, err := a.verify(token)
			if test.wantOK && err != nil {
				t.Fatalf("valid token rejected: %v", err)
			}
			if !test.wantOK && err == nil {
				t.Fatal("token with invalid issuer/audience was accepted")
			}
		})
	}
}

func TestConcurrentUnknownKeyRefreshIsSingleFlight(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		time.Sleep(50 * time.Millisecond)
		writeTestJWKS(t, w, "known", &privateKey.PublicKey)
	}))
	defer server.Close()

	now := time.Unix(20_000, 0)
	a := New(Options{JWKSURL: server.URL, Now: func() time.Time { return now }})
	const callers = 8
	start := make(chan struct{})
	var wait sync.WaitGroup
	wait.Add(callers)
	for i := 0; i < callers; i++ {
		go func(index int) {
			defer wait.Done()
			<-start
			_, _ = a.key(fmt.Sprintf("missing-%d", index))
		}(i)
	}
	close(start)
	wait.Wait()

	if got := requests.Load(); got != 1 {
		t.Fatalf("JWKS requests = %d, want 1", got)
	}
}

func TestUnknownKeyRefreshIsThrottled(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		writeTestJWKS(t, w, "known", &privateKey.PublicKey)
	}))
	defer server.Close()

	now := time.Unix(20_000, 0)
	a := New(Options{JWKSURL: server.URL, Now: func() time.Time { return now }})
	for _, kid := range []string{"missing-1", "missing-2", "missing-3"} {
		if _, err := a.key(kid); err == nil {
			t.Fatalf("unknown key %q was accepted", kid)
		}
	}
	if got := requests.Load(); got != 1 {
		t.Fatalf("JWKS requests = %d, want 1 inside throttle window", got)
	}
}

func TestRefreshKeysRejectsBadHTTPStatusAndOversizedBody(t *testing.T) {
	t.Run("status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"keys":[]}`))
		}))
		defer server.Close()
		a := New(Options{JWKSURL: server.URL})
		if err := a.refreshKeys(); err == nil {
			t.Fatal("non-2xx JWKS response was accepted")
		}
	})

	t.Run("oversized", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(strings.Repeat(" ", (1<<20)+1) + `{"keys":[]}`))
		}))
		defer server.Close()
		a := New(Options{JWKSURL: server.URL})
		if err := a.refreshKeys(); err == nil {
			t.Fatal("oversized JWKS response was accepted")
		}
	})
}

func TestRefreshKeysUsesConfiguredHTTPTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(200 * time.Millisecond)
		_, _ = w.Write([]byte(`{"keys":[]}`))
	}))
	defer server.Close()
	a := New(Options{
		JWKSURL:    server.URL,
		HTTPClient: &http.Client{Timeout: 20 * time.Millisecond},
	})
	started := time.Now()
	err := a.refreshKeys()
	if err == nil {
		t.Fatal("timed-out JWKS request was accepted")
	}
	if elapsed := time.Since(started); elapsed >= 150*time.Millisecond {
		t.Fatalf("JWKS timeout took %s, want <150ms", elapsed)
	}
}

func writeTestJWKS(t *testing.T, w http.ResponseWriter, kid string, key *rsa.PublicKey) {
	t.Helper()
	exponent := big.NewInt(int64(key.E)).Bytes()
	err := json.NewEncoder(w).Encode(map[string]any{
		"keys": []map[string]string{{
			"kid": kid,
			"n":   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(exponent),
		}},
	})
	if err != nil {
		t.Fatalf("encode JWKS: %v", err)
	}
}

func testAuthenticator(t *testing.T, kid string) (*Authenticator, *rsa.PrivateKey) {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	a := New(Options{})
	a.keys[kid] = &privateKey.PublicKey
	a.fetched = time.Now()
	return a, privateKey
}

func signTestToken(t *testing.T, privateKey *rsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	headerBytes, err := json.Marshal(map[string]any{"alg": "RS256", "kid": kid, "typ": "JWT"})
	if err != nil {
		t.Fatalf("marshal header: %v", err)
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}
	header := base64.RawURLEncoding.EncodeToString(headerBytes)
	payload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	digest := sha256.Sum256([]byte(header + "." + payload))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(signature)
}
