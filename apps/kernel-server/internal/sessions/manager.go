package sessions

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
)

type Manager struct {
	mu             sync.RWMutex
	options        Options
	runtime        Runtime
	clock          Clock
	sessions       map[string]Session
	pending        int
	pendingByOwner map[string]int
	shuttingDown   bool
	runtimeOps     sync.WaitGroup

	ownerMu    sync.Mutex
	ownerLocks map[string]*ownerLock
}

type ownerLock struct {
	mu   sync.Mutex
	refs int
}

func NewManager(options Options, runtime Runtime, clock Clock) *Manager {
	if clock == nil {
		clock = SystemClock{}
	}
	if options.MaxSessionsPerOwner <= 0 {
		options.MaxSessionsPerOwner = 1
	}
	return &Manager{
		options:        options,
		runtime:        runtime,
		clock:          clock,
		sessions:       make(map[string]Session),
		pendingByOwner: make(map[string]int),
		ownerLocks:     make(map[string]*ownerLock),
	}
}

func (m *Manager) CreateOrResume(ctx context.Context, owner, profile string) (Session, error) {
	unlockOwner := m.lockOwner(owner)
	defer unlockOwner()

	for {
		session, found, err := m.reserveAliveCheck(owner, profile)
		if err != nil {
			return Session{}, err
		}
		if found {
			alive := m.runtime.Alive(ctx, session.Handle.ID)
			if alive {
				now := m.clock.Now()
				m.mu.Lock()
				current, unchanged := m.sessions[session.ID]
				if unchanged && current.Status == StatusActive && current.Handle.ID == session.Handle.ID {
					current.LastActivity = now
					current.ExpiresAt = now.Add(m.options.IdleTimeout)
					m.sessions[session.ID] = current
				}
				m.mu.Unlock()
				m.runtimeOps.Done()
				if unchanged && current.Status == StatusActive && current.Handle.ID == session.Handle.ID {
					return current, nil
				}
				continue
			}

			m.mu.Lock()
			current, unchanged := m.sessions[session.ID]
			markedStopping := false
			if unchanged && current.Status == StatusActive && current.Handle.ID == session.Handle.ID {
				current.Status = StatusStopping
				m.sessions[session.ID] = current
				markedStopping = true
			}
			m.mu.Unlock()
			if markedStopping {
				_ = m.runtime.Stop(ctx, current.Handle.ID)
				m.mu.Lock()
				if latest, ok := m.sessions[session.ID]; ok && latest.Status == StatusStopping && latest.Handle.ID == current.Handle.ID {
					delete(m.sessions, session.ID)
				}
				m.mu.Unlock()
			}
			m.runtimeOps.Done()
			continue
		}

		if err := m.reserveStart(owner); err != nil {
			return Session{}, err
		}
		id, err := newSessionID()
		if err != nil {
			m.completeStart(owner, nil)
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
			m.completeStart(owner, nil)
			return Session{}, err
		}
		now := m.clock.Now()
		session = Session{
			ID:           id,
			Owner:        owner,
			Profile:      profile,
			Handle:       handle,
			LastActivity: now,
			ExpiresAt:    now.Add(m.options.IdleTimeout),
			Status:       StatusActive,
		}
		m.completeStart(owner, &session)
		return session, nil
	}
}

func (m *Manager) Get(owner, id string) (Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, ok := m.sessions[id]
	if !ok {
		return Session{}, ErrNotFound
	}
	if session.Owner != owner {
		return Session{}, ErrForbidden
	}
	return session, nil
}

func (m *Manager) Touch(owner, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, ok := m.sessions[id]
	if !ok {
		return ErrNotFound
	}
	if session.Owner != owner {
		return ErrForbidden
	}
	now := m.clock.Now()
	session.LastActivity = now
	session.ExpiresAt = now.Add(m.options.IdleTimeout)
	m.sessions[id] = session
	return nil
}

func (m *Manager) Delete(ctx context.Context, owner, id string) error {
	unlockOwner := m.lockOwner(owner)
	defer unlockOwner()

	m.mu.Lock()
	session, ok := m.sessions[id]
	if !ok {
		m.mu.Unlock()
		return ErrNotFound
	}
	if session.Owner != owner {
		m.mu.Unlock()
		return ErrForbidden
	}
	if m.runtime == nil {
		m.mu.Unlock()
		return errors.New("session runtime is not configured")
	}
	if m.shuttingDown {
		m.mu.Unlock()
		return ErrShuttingDown
	}
	if session.Status != StatusActive {
		m.mu.Unlock()
		return ErrNotFound
	}
	session.Status = StatusStopping
	m.sessions[id] = session
	m.runtimeOps.Add(1)
	m.mu.Unlock()
	defer m.runtimeOps.Done()

	// Detach from the caller's context: browsers fire this delete during page
	// unload and abort it, which used to kill the container but strand the
	// session record ("zombie" that resumes into a 502).
	stopCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	defer cancel()
	if err := m.runtime.Stop(stopCtx, session.Handle.ID); err != nil {
		m.mu.Lock()
		if current, ok := m.sessions[id]; ok && current.Status == StatusStopping && current.Handle.ID == session.Handle.ID {
			current.Status = StatusActive
			m.sessions[id] = current
		}
		m.mu.Unlock()
		return err
	}
	m.mu.Lock()
	if current, ok := m.sessions[id]; ok && current.Status == StatusStopping && current.Handle.ID == session.Handle.ID {
		delete(m.sessions, id)
	}
	m.mu.Unlock()
	return nil
}

func (m *Manager) ReapExpired(ctx context.Context) error {
	m.mu.Lock()
	var errs []error
	now := m.clock.Now()
	var expired []Session
	if m.shuttingDown {
		m.mu.Unlock()
		return nil
	}
	for id, session := range m.sessions {
		if session.Status != StatusActive || now.Before(session.ExpiresAt) {
			continue
		}
		if m.runtime == nil {
			errs = append(errs, errors.New("session runtime is not configured"))
			continue
		}
		session.Status = StatusStopping
		m.sessions[id] = session
		expired = append(expired, session)
		m.runtimeOps.Add(1)
	}
	m.mu.Unlock()

	for _, session := range expired {
		err := m.runtime.Stop(ctx, session.Handle.ID)
		m.finishStop(session, err)
		m.runtimeOps.Done()
		if err != nil {
			errs = append(errs, fmt.Errorf("stop session %s: %w", session.ID, err))
		}
	}
	return errors.Join(errs...)
}

func (m *Manager) StopAll(ctx context.Context) error {
	m.mu.Lock()
	m.shuttingDown = true
	m.mu.Unlock()
	m.runtimeOps.Wait()

	m.mu.Lock()
	if m.runtime == nil {
		if len(m.sessions) == 0 {
			m.mu.Unlock()
			return nil
		}
		m.mu.Unlock()
		return errors.New("session runtime is not configured")
	}
	var active []Session
	for id, session := range m.sessions {
		if session.Status != StatusActive {
			continue
		}
		session.Status = StatusStopping
		m.sessions[id] = session
		active = append(active, session)
	}
	m.mu.Unlock()

	var errs []error
	for _, session := range active {
		err := m.runtime.Stop(ctx, session.Handle.ID)
		m.finishStop(session, err)
		if err != nil {
			errs = append(errs, fmt.Errorf("stop session %s: %w", session.ID, err))
		}
	}
	return errors.Join(errs...)
}

func (m *Manager) reserveAliveCheck(owner, profile string) (Session, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shuttingDown {
		return Session{}, false, ErrShuttingDown
	}
	if m.runtime == nil {
		return Session{}, false, errors.New("session runtime is not configured")
	}
	for _, session := range m.sessions {
		if session.Owner == owner && session.Profile == profile && session.Status == StatusActive {
			m.runtimeOps.Add(1)
			return session, true, nil
		}
	}
	return Session{}, false, nil
}

func (m *Manager) reserveStart(owner string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shuttingDown {
		return ErrShuttingDown
	}
	if m.runtime == nil {
		return errors.New("session runtime is not configured")
	}
	if m.ownerCountLocked(owner)+m.pendingByOwner[owner] >= m.options.MaxSessionsPerOwner {
		return ErrOwnerCapacity
	}
	if len(m.sessions)+m.pending >= m.options.MaxSessions {
		return ErrCapacity
	}
	m.pending++
	m.pendingByOwner[owner]++
	m.runtimeOps.Add(1)
	return nil
}

func (m *Manager) completeStart(owner string, session *Session) {
	m.mu.Lock()
	m.pending--
	m.pendingByOwner[owner]--
	if m.pendingByOwner[owner] == 0 {
		delete(m.pendingByOwner, owner)
	}
	if session != nil {
		m.sessions[session.ID] = *session
	}
	m.mu.Unlock()
	m.runtimeOps.Done()
}

func (m *Manager) finishStop(session Session, stopErr error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	current, ok := m.sessions[session.ID]
	if !ok || current.Status != StatusStopping || current.Handle.ID != session.Handle.ID {
		return
	}
	if stopErr == nil {
		delete(m.sessions, session.ID)
		return
	}
	current.Status = StatusActive
	m.sessions[session.ID] = current
}

func (m *Manager) ownerCountLocked(owner string) int {
	count := 0
	for _, session := range m.sessions {
		if session.Owner == owner {
			count++
		}
	}
	return count
}

func (m *Manager) lockOwner(owner string) func() {
	m.ownerMu.Lock()
	entry := m.ownerLocks[owner]
	if entry == nil {
		entry = &ownerLock{}
		m.ownerLocks[owner] = entry
	}
	entry.refs++
	m.ownerMu.Unlock()

	entry.mu.Lock()
	return func() {
		entry.mu.Unlock()
		m.ownerMu.Lock()
		entry.refs--
		if entry.refs == 0 {
			delete(m.ownerLocks, owner)
		}
		m.ownerMu.Unlock()
	}
}

func newSessionID() (string, error) {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return "session-" + hex.EncodeToString(bytes[:]), nil
}
