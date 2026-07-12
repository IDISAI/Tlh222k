package proxy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"
)

const ticketLifetime = 5 * time.Minute

var ErrInvalidTicket = errors.New("invalid connection ticket")

type ticketPayload struct {
	SessionID string `json:"sessionID"`
	Subject   string `json:"subject"`
	Expires   int64  `json:"exp"`
}

type Tickets struct {
	secret []byte
	now    func() time.Time
}

func NewTickets(secret []byte, now func() time.Time) *Tickets {
	if now == nil {
		now = time.Now
	}
	return &Tickets{secret: append([]byte(nil), secret...), now: now}
}

func (t *Tickets) Issue(sessionID, subject string) (string, time.Time, error) {
	expiresAt := t.now().Add(ticketLifetime)
	payload, err := json.Marshal(ticketPayload{SessionID: sessionID, Subject: subject, Expires: expiresAt.Unix()})
	if err != nil {
		return "", time.Time{}, err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	return encodedPayload + "." + base64.RawURLEncoding.EncodeToString(t.sign(encodedPayload)), expiresAt, nil
}

func (t *Tickets) Validate(ticket, sessionID, subject string) error {
	verifiedSubject, err := t.Verify(ticket, sessionID)
	if err != nil || verifiedSubject != subject {
		return ErrInvalidTicket
	}
	return nil
}

// Verify validates a short-lived connection ticket and returns its signed
// subject. Proxy routes use this subject as their authentication principal;
// browser WebSocket clients cannot attach Clerk Authorization headers.
func (t *Tickets) Verify(ticket, sessionID string) (string, error) {
	payloadPart, signaturePart, ok := splitTicket(ticket)
	if !ok {
		return "", ErrInvalidTicket
	}
	signature, err := base64.RawURLEncoding.DecodeString(signaturePart)
	if err != nil || !hmac.Equal(signature, t.sign(payloadPart)) {
		return "", ErrInvalidTicket
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadPart)
	if err != nil {
		return "", ErrInvalidTicket
	}
	var payload ticketPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return "", ErrInvalidTicket
	}
	if payload.SessionID != sessionID || payload.Subject == "" || t.now().Unix() >= payload.Expires {
		return "", ErrInvalidTicket
	}
	return payload.Subject, nil
}

func (t *Tickets) sign(payload string) []byte {
	mac := hmac.New(sha256.New, t.secret)
	_, _ = mac.Write([]byte(payload))
	return mac.Sum(nil)
}

func splitTicket(ticket string) (string, string, bool) {
	for i := 0; i < len(ticket); i++ {
		if ticket[i] == '.' && i > 0 && i < len(ticket)-1 {
			return ticket[:i], ticket[i+1:], true
		}
	}
	return "", "", false
}
