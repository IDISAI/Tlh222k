package proxy

import (
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
