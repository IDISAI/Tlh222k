package proxy

import (
	"errors"
	"testing"
	"time"
)

func TestVerifyReturnsSignedSubjectAndRejectsWrongSession(t *testing.T) {
	tickets := NewTickets([]byte("test-secret"), func() time.Time { return time.Unix(1_000, 0) })
	ticket, _, err := tickets.Issue("session-1", "user-1")
	if err != nil {
		t.Fatalf("issue ticket: %v", err)
	}
	subject, err := tickets.Verify(ticket, "session-1")
	if err != nil {
		t.Fatalf("verify ticket: %v", err)
	}
	if subject != "user-1" {
		t.Fatalf("subject = %q, want user-1", subject)
	}
	if _, err := tickets.Verify(ticket, "session-2"); !errors.Is(err, ErrInvalidTicket) {
		t.Fatalf("wrong-session error = %v, want ErrInvalidTicket", err)
	}
}
