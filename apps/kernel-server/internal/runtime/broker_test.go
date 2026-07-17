package runtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/lh222k/kernel-server/internal/sessions"
)

func TestBrokerRuntimeSendsOnlySessionAndProfileWithBearer(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/sessions" {
			t.Fatalf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer internal-secret" {
			t.Fatalf("authorization = %q", r.Header.Get("Authorization"))
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		_ = json.NewEncoder(w).Encode(sessions.RuntimeHandle{ID: "container-1", Endpoint: "http://session:8888", Token: "jupyter"})
	}))
	defer server.Close()
	runtime, err := NewBrokerRuntime(server.URL, "internal-secret", server.Client())
	if err != nil {
		t.Fatal(err)
	}
	handle, err := runtime.Start(context.Background(), sessions.StartRequest{
		SessionID: "session-1", Profile: "data-science", CPU: "99", Memory: "999g", Pids: 999, Network: "host",
	})
	if err != nil {
		t.Fatal(err)
	}
	if handle.ID != "container-1" || len(got) != 2 || got["sessionId"] != "session-1" || got["profile"] != "data-science" {
		t.Fatalf("handle/body = %+v/%#v", handle, got)
	}
}

func TestBrokerRuntimeUsesFixedControlRoutes(t *testing.T) {
	var requests []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.Method+" "+r.URL.Path)
		if r.Header.Get("Authorization") != "Bearer internal-secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Method == http.MethodGet {
			_ = json.NewEncoder(w).Encode(map[string]bool{"alive": true})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	runtime, err := NewBrokerRuntime(server.URL, "internal-secret", server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if !runtime.Alive(context.Background(), "container-1") {
		t.Fatal("broker reported managed container dead")
	}
	if err := runtime.Stop(context.Background(), "container-1"); err != nil {
		t.Fatal(err)
	}
	if err := runtime.RemoveStaleContainers(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := []string{"GET /v1/containers/container-1/alive", "DELETE /v1/containers/container-1", "POST /v1/reconcile"}
	if len(requests) != len(want) {
		t.Fatalf("requests = %#v, want %#v", requests, want)
	}
	for i := range want {
		if requests[i] != want[i] {
			t.Fatalf("requests = %#v, want %#v", requests, want)
		}
	}
}
