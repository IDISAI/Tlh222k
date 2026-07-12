// Package api holds the HTTP handlers for notebook CRUD. Notebooks are opaque
// .ipynb JSON to this server; only admins may mutate, anyone may read published.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/proxy"
	"github.com/lh222k/kernel-server/internal/sessions"
	"github.com/lh222k/kernel-server/internal/store"
)

type Handler struct {
	store    store.Store
	sessions *sessions.Manager
	tickets  *proxy.Tickets
	jupyter  *proxy.Jupyter
}

func New(s store.Store) *Handler { return &Handler{store: s} }

func NewWithSessions(s store.Store, manager *sessions.Manager, tickets *proxy.Tickets) *Handler {
	return &Handler{
		store:    s,
		sessions: manager,
		tickets:  tickets,
		jupyter:  proxy.NewJupyter(manager, tickets),
	}
}

// Register wires routes onto the mux. Admin-only routes are wrapped with
// RequireAdmin; /api/published/* is public (web viewers).
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/notebooks", auth.RequireAdmin(h.list))
	mux.HandleFunc("GET /api/notebooks/{slug}", auth.RequireAdmin(h.get))
	mux.HandleFunc("PUT /api/notebooks/{slug}", auth.RequireAdmin(h.put))
	mux.HandleFunc("DELETE /api/notebooks/{slug}", auth.RequireAdmin(h.remove))

	mux.HandleFunc("GET /api/published/{slug}", h.published)

	if h.sessions != nil {
		mux.HandleFunc("POST /api/sessions", auth.RequireAuthenticated(h.createSession))
		mux.HandleFunc("GET /api/sessions/{id}", auth.RequireAuthenticated(h.getSession))
		mux.HandleFunc("POST /api/sessions/{id}/interrupt", auth.RequireAuthenticated(h.interruptSession))
		mux.HandleFunc("POST /api/sessions/{id}/restart", auth.RequireAuthenticated(h.restartSession))
		mux.HandleFunc("DELETE /api/sessions/{id}", auth.RequireAuthenticated(h.deleteSession))
		mux.HandleFunc("/api/sessions/{id}/jupyter/{path...}", auth.RequireAuthenticated(h.jupyter.ServeHTTP))
	}
}

type createSessionRequest struct {
	Profile string `json:"profile"`
}

type sessionResponse struct {
	ID               string          `json:"id"`
	Profile          string          `json:"profile"`
	Status           sessions.Status `json:"status"`
	ProxyBaseURL     string          `json:"proxyBaseUrl"`
	ConnectionTicket string          `json:"connectionTicket"`
	ExpiresAt        time.Time       `json:"expiresAt"`
}

func (h *Handler) createSession(w http.ResponseWriter, r *http.Request) {
	var body createSessionRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if !store.ValidRuntimeProfile(body.Profile) {
		writeErr(w, http.StatusBadRequest, errors.New("invalid profile"))
		return
	}
	principal := auth.PrincipalFrom(r)
	session, err := h.sessions.CreateOrResume(r.Context(), principal.Subject, body.Profile)
	if err != nil {
		if errors.Is(err, sessions.ErrCapacity) {
			writeErr(w, http.StatusTooManyRequests, err)
			return
		}
		writeErr(w, http.StatusInternalServerError, errors.New("session unavailable"))
		return
	}
	h.writeSession(w, session)
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
	session, ok := h.ownedSession(w, r)
	if !ok {
		return
	}
	h.writeSession(w, session)
}

func (h *Handler) interruptSession(w http.ResponseWriter, r *http.Request) {
	h.controlSession(w, r, "interrupt")
}

func (h *Handler) restartSession(w http.ResponseWriter, r *http.Request) {
	h.controlSession(w, r, "restart")
}

func (h *Handler) controlSession(w http.ResponseWriter, r *http.Request, action string) {
	session, ok := h.ownedSession(w, r)
	if !ok {
		return
	}
	if err := h.jupyter.Control(r.Context(), session, action); err != nil {
		writeErr(w, http.StatusBadGateway, errors.New("runtime control failed"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteSession(w http.ResponseWriter, r *http.Request) {
	principal := auth.PrincipalFrom(r)
	if err := h.sessions.Delete(r.Context(), principal.Subject, r.PathValue("id")); err != nil {
		writeOwnedSessionError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ownedSession(w http.ResponseWriter, r *http.Request) (sessions.Session, bool) {
	principal := auth.PrincipalFrom(r)
	session, err := h.sessions.Get(principal.Subject, r.PathValue("id"))
	if err != nil {
		writeOwnedSessionError(w, err)
		return sessions.Session{}, false
	}
	return session, true
}

func (h *Handler) writeSession(w http.ResponseWriter, session sessions.Session) {
	ticket, expiresAt, err := h.tickets.Issue(session.ID, session.Owner)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, errors.New("ticket unavailable"))
		return
	}
	writeJSON(w, http.StatusOK, sessionResponse{
		ID:               session.ID,
		Profile:          session.Profile,
		Status:           session.Status,
		ProxyBaseURL:     fmt.Sprintf("/api/sessions/%s/jupyter/", session.ID),
		ConnectionTicket: ticket,
		ExpiresAt:        expiresAt,
	})
}

func writeOwnedSessionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sessions.ErrForbidden):
		writeErr(w, http.StatusForbidden, errors.New("forbidden"))
	case errors.Is(err, sessions.ErrNotFound):
		writeErr(w, http.StatusNotFound, errors.New("session not found"))
	default:
		writeErr(w, http.StatusInternalServerError, errors.New("session unavailable"))
	}
}

type notebookResponse struct {
	Notebook json.RawMessage `json:"notebook"`
	Meta     store.Meta      `json:"meta"`
}

type putRequest struct {
	Notebook       json.RawMessage `json:"notebook"`
	Title          string          `json:"title"`
	Published      *bool           `json:"published"`
	RuntimeProfile string          `json:"runtimeProfile"`
}

func (h *Handler) list(w http.ResponseWriter, _ *http.Request) {
	metas, err := h.store.List()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if metas == nil {
		metas = []store.Meta{}
	}
	writeJSON(w, http.StatusOK, metas)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if !store.ValidSlug(slug) {
		writeErr(w, http.StatusBadRequest, errors.New("invalid slug"))
		return
	}
	notebook, meta, err := h.store.Load(slug)
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, notebookResponse{Notebook: notebook, Meta: meta})
}

func (h *Handler) published(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if !store.ValidSlug(slug) {
		writeErr(w, http.StatusBadRequest, errors.New("invalid slug"))
		return
	}
	notebook, meta, err := h.store.Load(slug)
	if errors.Is(err, store.ErrNotFound) || (err == nil && !meta.Published) {
		writeErr(w, http.StatusNotFound, errors.New("notebook not found"))
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, notebookResponse{Notebook: notebook, Meta: meta})
}

func (h *Handler) put(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if !store.ValidSlug(slug) {
		writeErr(w, http.StatusBadRequest, errors.New("invalid slug"))
		return
	}
	var body putRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if len(body.Notebook) == 0 {
		writeErr(w, http.StatusBadRequest, errors.New("missing notebook"))
		return
	}
	if !store.ValidRuntimeProfile(body.RuntimeProfile) {
		writeErr(w, http.StatusBadRequest, errors.New("invalid runtimeProfile"))
		return
	}
	// Omitted publication metadata defaults to draft. Publication must be
	// explicit so malformed/legacy clients cannot expose a notebook by default.
	published := false
	if body.Published != nil {
		published = *body.Published
	}
	meta, err := h.store.Save(slug, body.Notebook, body.Title, published, body.RuntimeProfile)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, meta)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if !store.ValidSlug(slug) {
		writeErr(w, http.StatusBadRequest, errors.New("invalid slug"))
		return
	}
	if err := h.store.Delete(slug); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
