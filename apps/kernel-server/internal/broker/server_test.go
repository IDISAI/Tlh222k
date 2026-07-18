package broker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/lh222k/kernel-server/internal/sessions"
)

type fakeController struct {
	starts     int
	start      sessions.StartRequest
	stopped    string
	reconciled bool
}

func (f *fakeController) Start(_ context.Context, request sessions.StartRequest) (sessions.RuntimeHandle, error) {
	f.starts++
	f.start = request
	return sessions.RuntimeHandle{ID: "container-1", Endpoint: "http://session:8888", Token: "jupyter-token"}, nil
}

func (f *fakeController) Stop(_ context.Context, id string) error {
	f.stopped = id
	return nil
}

func (*fakeController) Alive(context.Context, string) bool { return true }

func (f *fakeController) RemoveStaleContainers(context.Context) error {
	f.reconciled = true
	return nil
}

func TestServerRejectsUnknownProfileAndCallerDockerArguments(t *testing.T) {
	controller := &fakeController{}
	handler := NewServer("0123456789abcdef0123456789abcdef", controller, Policy{
		CPU: "1", Memory: "2g", Pids: 128, Network: "notebook-internal",
	})
	tests := []struct {
		name string
		body string
	}{
		{name: "unknown profile", body: `{"sessionId":"session-0123456789abcdef0123456789abcdef","profile":"custom"}`},
		{name: "caller docker arguments", body: `{"sessionId":"session-0123456789abcdef0123456789abcdef","profile":"data-science","cpu":"99","binds":["/:/host"]}`},
		{name: "unsafe session id", body: `{"sessionId":"../../host","profile":"data-science"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader(test.body))
			request.Header.Set("Authorization", "Bearer 0123456789abcdef0123456789abcdef")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", recorder.Code)
			}
		})
	}
	if controller.starts != 0 {
		t.Fatalf("controller starts = %d, want 0", controller.starts)
	}
}

func TestServerUsesFixedPolicyAndRequiresInternalBearer(t *testing.T) {
	controller := &fakeController{}
	handler := NewServer("0123456789abcdef0123456789abcdef", controller, Policy{
		CPU: "1", Memory: "2g", Pids: 128, Network: "notebook-internal",
	})
	body := `{"sessionId":"session-0123456789abcdef0123456789abcdef","profile":"ml-cpu"}`
	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader(body)))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d, want 401", unauthorized.Code)
	}

	request := httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer 0123456789abcdef0123456789abcdef")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", recorder.Code, recorder.Body.String())
	}
	if controller.start.SessionID != "session-0123456789abcdef0123456789abcdef" || controller.start.Profile != "ml-cpu" ||
		controller.start.CPU != "1" || controller.start.Memory != "2g" || controller.start.Pids != 128 || controller.start.Network != "notebook-internal" {
		t.Fatalf("start request = %+v, want fixed policy", controller.start)
	}
	var handle sessions.RuntimeHandle
	if err := json.Unmarshal(recorder.Body.Bytes(), &handle); err != nil || handle.ID != "container-1" || handle.Token != "jupyter-token" {
		t.Fatalf("response handle/error = %+v/%v", handle, err)
	}
}

func TestServerAcceptsEveryRuntimeProfileWithFixedPolicy(t *testing.T) {
	for _, profile := range []string{
		"data-science",
		"ml-cpu",
		"javascript",
		"cpp",
		"java",
		"rust",
		"go",
		"julia",
	} {
		t.Run(profile, func(t *testing.T) {
			controller := &fakeController{}
			handler := NewServer(
				"0123456789abcdef0123456789abcdef",
				controller,
				Policy{CPU: "1", Memory: "2g", Pids: 128, Network: "notebook-internal"},
			)
			body := fmt.Sprintf(
				`{"sessionId":"session-0123456789abcdef0123456789abcdef","profile":%q}`,
				profile,
			)
			request := httptest.NewRequest(
				http.MethodPost,
				"/v1/sessions",
				strings.NewReader(body),
			)
			request.Header.Set(
				"Authorization",
				"Bearer 0123456789abcdef0123456789abcdef",
			)
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusCreated {
				t.Fatalf("status = %d, want 201: %s", recorder.Code, recorder.Body.String())
			}
			if controller.start.Profile != profile ||
				controller.start.CPU != "1" ||
				controller.start.Memory != "2g" ||
				controller.start.Pids != 128 ||
				controller.start.Network != "notebook-internal" {
				t.Fatalf("start request = %+v, want profile plus fixed policy", controller.start)
			}
		})
	}
}
