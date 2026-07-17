package proxy

import (
	"net/http"
	"testing"
	"time"
)

func TestTicketRejectsWrongSessionAndExpiredSignature(t *testing.T) {
	now := time.Unix(1_000, 0)
	tickets := NewTickets([]byte("test-secret"), func() time.Time { return now })
	ticket, expiresAt, err := tickets.Issue("session-1", "user-1")
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	if expiresAt != now.Add(ticketLifetime) {
		t.Fatalf("expiresAt = %s, want %s", expiresAt, now.Add(ticketLifetime))
	}
	if err := tickets.Validate(ticket, "session-2", "user-1"); err == nil {
		t.Fatal("wrong-session ticket accepted")
	}

	now = now.Add(ticketLifetime + time.Minute)
	if err := tickets.Validate(ticket, "session-1", "user-1"); err == nil {
		t.Fatal("expired ticket accepted")
	}
}

func TestTicketCookieIsShortLivedHttpOnlyAndSessionScoped(t *testing.T) {
	now := time.Unix(2_000, 0)
	if ticketLifetime != 5*time.Minute {
		t.Fatalf("ticket lifetime = %s, want 5m", ticketLifetime)
	}
	cookie := ticketCookie("session-1", "signed-ticket", now.Add(ticketLifetime))
	if cookie.Name != "__Secure-kernel-ticket" {
		t.Fatalf("cookie name = %q, want __Secure-kernel-ticket", cookie.Name)
	}
	if cookie.Path != "/api/sessions/session-1/jupyter/" {
		t.Fatalf("cookie path = %q, want session-scoped proxy path", cookie.Path)
	}
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie security flags = HttpOnly:%v Secure:%v SameSite:%v", cookie.HttpOnly, cookie.Secure, cookie.SameSite)
	}
	if !cookie.Expires.Equal(now.Add(5*time.Minute)) || cookie.MaxAge != 300 {
		t.Fatalf("cookie expiry/max-age = %s/%d, want 5m/300", cookie.Expires, cookie.MaxAge)
	}
}
