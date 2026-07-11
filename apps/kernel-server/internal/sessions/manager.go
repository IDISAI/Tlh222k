package sessions

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
)

type Manager struct {
	mu       sync.Mutex
	options  Options
	runtime  Runtime
	clock    Clock
	sessions map[string]Session
}

func NewManager(options Options, runtime Runtime, clock Clock) *Manager {
	if clock == nil {
		clock = SystemClock{}
	}
	return &Manager{
		options:  options,
		runtime:  runtime,
		clock:    clock,
		sessions: make(map[string]Session),
	}
}

func (m *Manager) CreateOrResume(ctx context.Context, owner, profile string) (Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.clock.Now()
	for id, session := range m.sessions {
		if session.Owner == owner && session.Profile == profile && session.Status == StatusActive {
			session.LastActivity = now
			session.ExpiresAt = now.Add(m.options.IdleTimeout)
			m.sessions[id] = session
			return session, nil
		}
	}
	if m.activeCount() >= m.options.MaxSessions {
		return Session{}, ErrCapacity
	}
	if m.runtime == nil {
		return Session{}, errors.New("session runtime is not configured")
	}

	id, err := newSessionID()
	if err != nil {
		return Session{}, fmt.Errorf("generate session ID: %w", err)
	}
	handle, err := m.runtime.Start(ctx, StartRequest{
		SessionID: id,
		Profile:   profile,
		CPU:       m.options.CPU,
		Memory:    m.options.Memory,
		Pids:      m.options.Pids,
		Network:   m.options.Network,
	})
	if err != nil {
		return Session{}, err
	}
	session := Session{
		ID:           id,
		Owner:        owner,
		Profile:      profile,
		Handle:       handle,
		LastActivity: now,
		ExpiresAt:    now.Add(m.options.IdleTimeout),
		Status:       StatusActive,
	}
	m.sessions[id] = session
	return session, nil
}

func (m *Manager) Get(owner, id string) (Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, ok := m.sessions[id]
	if !ok {
		return Session{}, ErrNotFound
	}
	if session.Owner != owner {
		return Session{}, ErrForbidden
	}
	return session, nil
}

func (m *Manager) ReapExpired(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var errs []error
	now := m.clock.Now()
	for id, session := range m.sessions {
		if session.Status != StatusActive || now.Before(session.ExpiresAt) {
			continue
		}
		if m.runtime == nil {
			errs = append(errs, errors.New("session runtime is not configured"))
			continue
		}
		if err := m.runtime.Stop(ctx, session.Handle.ID); err != nil {
			errs = append(errs, fmt.Errorf("stop session %s: %w", id, err))
			continue
		}
		delete(m.sessions, id)
	}
	return errors.Join(errs...)
}

func (m *Manager) activeCount() int {
	count := 0
	for _, session := range m.sessions {
		if session.Status == StatusActive {
			count++
		}
	}
	return count
}

func newSessionID() (string, error) {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return "session-" + hex.EncodeToString(bytes[:]), nil
}
