// Package api holds the HTTP handlers for notebook CRUD. Notebooks are opaque
// .ipynb JSON to this server; only admins may mutate, anyone may read published.
package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/lh222k/kernel-server/internal/auth"
	"github.com/lh222k/kernel-server/internal/store"
)

type Handler struct {
	store store.Store
}

func New(s store.Store) *Handler { return &Handler{store: s} }

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
	published := true
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
