package broker

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/lh222k/kernel-server/internal/sessions"
)

const maxRequestBytes = 16 << 10

var (
	sessionIDPattern   = regexp.MustCompile(`^session-[a-f0-9]{32}$`)
	containerIDPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$`)
)

type Controller interface {
	Start(context.Context, sessions.StartRequest) (sessions.RuntimeHandle, error)
	Stop(context.Context, string) error
	Alive(context.Context, string) bool
	RemoveStaleContainers(context.Context) error
}

type Policy struct {
	CPU     string
	Memory  string
	Pids    int
	Network string
}

type Server struct {
	token      string
	controller Controller
	policy     Policy
	mux        *http.ServeMux
}

func NewServer(token string, controller Controller, policy Policy) http.Handler {
	server := &Server{token: token, controller: controller, policy: policy, mux: http.NewServeMux()}
	server.mux.HandleFunc("GET /health", server.health)
	server.mux.HandleFunc("POST /v1/sessions", server.authorize(server.start))
	server.mux.HandleFunc("GET /v1/containers/{id}/alive", server.authorize(server.alive))
	server.mux.HandleFunc("DELETE /v1/containers/{id}", server.authorize(server.stop))
	server.mux.HandleFunc("POST /v1/reconcile", server.authorize(server.reconcile))
	return server
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	s.mux.ServeHTTP(w, r)
}

func (s *Server) authorize(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || s.token == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(s.token)) != 1 {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	}
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) start(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SessionID string `json:"sessionId"`
		Profile   string `json:"profile"`
	}
	if err := decodeStrict(w, r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if !sessionIDPattern.MatchString(body.SessionID) || (body.Profile != "data-science" && body.Profile != "ml-cpu") {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	handle, err := s.controller.Start(r.Context(), sessions.StartRequest{
		SessionID: body.SessionID,
		Profile:   body.Profile,
		CPU:       s.policy.CPU,
		Memory:    s.policy.Memory,
		Pids:      s.policy.Pids,
		Network:   s.policy.Network,
	})
	if err != nil {
		writeError(w, http.StatusBadGateway, "runtime unavailable")
		return
	}
	writeJSON(w, http.StatusCreated, handle)
}

func (s *Server) alive(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !containerIDPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid container id")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"alive": s.controller.Alive(r.Context(), id)})
}

func (s *Server) stop(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !containerIDPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid container id")
		return
	}
	if err := s.controller.Stop(r.Context(), id); err != nil {
		writeError(w, http.StatusBadGateway, "runtime unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) reconcile(w http.ResponseWriter, r *http.Request) {
	if err := s.controller.RemoveStaleContainers(r.Context()); err != nil {
		writeError(w, http.StatusBadGateway, "runtime unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeStrict(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request must contain one JSON value")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
