package runtime

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/lh222k/kernel-server/internal/sessions"
)

type recordedCommand struct {
	name string
	args []string
}

func TestDockerRuntimeStopsContainerWhenJupyterReadinessFails(t *testing.T) {
	runner := &recordingRunner{outputs: [][]byte{[]byte("container-1\n"), []byte("true kernel-broker\n"), nil}}
	runtime := NewDockerRuntime(runner, Images{"data-science": "data-image"}, WithReadyCheck(func(context.Context, string, string) error {
		return errors.New("not ready")
	}))

	_, err := runtime.Start(context.Background(), sessions.StartRequest{
		SessionID: "session-1", Profile: "data-science", CPU: "1", Memory: "2g", Pids: 128, Network: "notebook-internal",
	})
	if err == nil || !strings.Contains(err.Error(), "wait for Jupyter runtime: not ready") {
		t.Fatalf("start error = %v, want readiness error", err)
	}
	if len(runner.commands) != 3 {
		t.Fatalf("commands = %d, want docker run, managed-label inspect, then cleanup", len(runner.commands))
	}
	if command := runner.commands[2]; command.name != "docker" || !slices.Equal(command.args, []string{"rm", "--force", "container-1"}) {
		t.Fatalf("cleanup command = %q %#v, want docker rm --force container-1", command.name, command.args)
	}
}

func TestDockerRuntimeUsesLoopbackPortForHostDevelopment(t *testing.T) {
	runner := &recordingRunner{outputs: [][]byte{[]byte("container-1\n"), []byte("127.0.0.1:49152\n")}}
	runtime := NewDockerRuntime(runner, Images{"data-science": "data-image"}, WithHostProxy(), WithReadyCheck(func(_ context.Context, endpoint, _ string) error {
		if endpoint != "http://127.0.0.1:49152" {
			return errors.New("unexpected endpoint " + endpoint)
		}
		return nil
	}))

	_, err := runtime.Start(context.Background(), sessions.StartRequest{
		SessionID: "session-1", Profile: "data-science", CPU: "1", Memory: "2g", Pids: 128, Network: "notebook-internal",
	})
	if err != nil {
		t.Fatalf("start runtime: %v", err)
	}
	if !slices.Contains(runner.commands[0].args, "--publish") || !slices.Contains(runner.commands[0].args, "127.0.0.1::8888") {
		t.Fatalf("docker run args = %#v, want loopback publish", runner.commands[0].args)
	}
	if slices.Contains(runner.commands[0].args, "--network") {
		t.Fatalf("docker run args = %#v, dev host proxy must use Docker's publishable default bridge", runner.commands[0].args)
	}
	if len(runner.commands) != 2 || !slices.Equal(runner.commands[1].args, []string{"port", "container-1", "8888/tcp"}) {
		t.Fatalf("port command = %#v, want docker port", runner.commands)
	}
}

type recordingRunner struct {
	commands []recordedCommand
	output   []byte
	outputs  [][]byte
	err      error
}

func (r *recordingRunner) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	index := len(r.commands)
	r.commands = append(r.commands, recordedCommand{name: name, args: slices.Clone(args)})
	if index < len(r.outputs) {
		return r.outputs[index], r.err
	}
	return r.output, r.err
}

func TestDockerRuntimeStartUsesLockedDownRunArguments(t *testing.T) {
	runner := &recordingRunner{output: []byte("container-1\n")}
	runtime := NewDockerRuntime(runner, Images{
		"data-science": "local/notebook-data-science:dev",
		"ml-cpu":       "local/notebook-ml-cpu:dev",
	}, WithReadyCheck(func(context.Context, string, string) error { return nil }))

	handle, err := runtime.Start(context.Background(), sessions.StartRequest{
		SessionID: "session-1",
		Profile:   "data-science",
		CPU:       "1",
		Memory:    "2g",
		Pids:      128,
		Network:   "notebook-internal",
	})
	if err != nil {
		t.Fatalf("start runtime: %v", err)
	}
	if len(runner.commands) != 1 {
		t.Fatalf("commands = %d, want 1", len(runner.commands))
	}
	command := runner.commands[0]
	if command.name != "docker" {
		t.Fatalf("command = %q, want docker", command.name)
	}
	wantPrefix := []string{
		"run", "--detach", "--network", "notebook-internal", "--read-only",
		"--tmpfs", "/tmp:rw,noexec,nosuid,size=256m,mode=1777",
		"--tmpfs", "/home/jovyan/.cache:rw,nosuid,size=256m,mode=1777",
		"--tmpfs", "/home/jovyan/.config:rw,nosuid,size=128m,mode=1777",
		"--tmpfs", "/home/jovyan/.ipython:rw,nosuid,size=128m,mode=1777",
		"--tmpfs", "/home/jovyan/.jupyter:rw,nosuid,size=128m,mode=1777",
		"--tmpfs", "/home/jovyan/.local:rw,nosuid,size=256m,mode=1777",
		"--tmpfs", "/home/jovyan/.cargo:rw,nosuid,size=512m,mode=0700,uid=1000,gid=100",
		"--tmpfs", "/home/jovyan/.ivy2:rw,nosuid,size=256m,mode=0700,uid=1000,gid=100",
		"--tmpfs", "/home/jovyan/.julia:rw,nosuid,size=512m,mode=0700,uid=1000,gid=100",
		"--tmpfs", "/home/jovyan/go:rw,nosuid,size=512m,mode=0700,uid=1000,gid=100",
		"--tmpfs", "/home/jovyan/work:rw,nosuid,size=512m,mode=1777",
		"--cap-drop", "ALL", "--security-opt", "no-new-privileges",
		"--pids-limit", "128", "--cpus", "1", "--memory", "2g",
		"--user", "1000:100", "--label", "notebook.session=session-1",
		"--label", "notebook.managed-by=kernel-broker",
	}
	if len(command.args) < len(wantPrefix) || !slices.Equal(command.args[:len(wantPrefix)], wantPrefix) {
		t.Fatalf("docker run prefix = %#v, want %#v", command.args, wantPrefix)
	}
	for _, forbidden := range []string{"-v", "--volume", "-p", "--publish"} {
		if slices.Contains(command.args, forbidden) {
			t.Fatalf("docker run contains forbidden argument %q: %#v", forbidden, command.args)
		}
	}
	if !slices.Contains(command.args, "local/notebook-data-science:dev") {
		t.Fatalf("docker run args = %#v, want configured data-science image", command.args)
	}
	if handle.ID != "container-1" || handle.Endpoint != "http://session-1:8888" {
		t.Fatalf("handle = %+v, want container ID and internal DNS endpoint", handle)
	}
	if len(handle.Token) != 64 {
		t.Fatalf("token length = %d, want 64 hex characters", len(handle.Token))
	}
	if !slices.Contains(command.args, "JUPYTER_TOKEN="+handle.Token) {
		t.Fatal("docker run does not pass generated token to container")
	}
}

func TestDockerRuntimeStartRejectsUnknownProfile(t *testing.T) {
	runner := &recordingRunner{}
	runtime := NewDockerRuntime(runner, Images{"data-science": "data-image", "ml-cpu": "ml-image"})

	_, err := runtime.Start(context.Background(), sessions.StartRequest{Profile: "custom"})
	if err == nil || !strings.Contains(err.Error(), "unsupported runtime profile") {
		t.Fatalf("start error = %v, want unsupported profile", err)
	}
	if len(runner.commands) != 0 {
		t.Fatalf("commands = %d, want 0", len(runner.commands))
	}
}

func TestDefaultImagesCoversEveryRuntimeProfile(t *testing.T) {
	images := DefaultImages()
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
		if image := strings.TrimSpace(images[profile]); image == "" {
			t.Errorf("DefaultImages()[%q] = %q, want configured image", profile, image)
		}
	}
}

func TestDockerRuntimeStartsEveryProfileWithItsConfiguredImage(t *testing.T) {
	images := Images{
		"data-science": "registry/data-science:test",
		"ml-cpu":       "registry/ml-cpu:test",
		"javascript":   "registry/javascript:test",
		"cpp":          "registry/cpp:test",
		"java":         "registry/java:test",
		"rust":         "registry/rust:test",
		"go":           "registry/go:test",
		"julia":        "registry/julia:test",
	}

	for profile, image := range images {
		t.Run(profile, func(t *testing.T) {
			runner := &recordingRunner{output: []byte("container-1\n")}
			runtime := NewDockerRuntime(
				runner,
				images,
				WithReadyCheck(func(context.Context, string, string) error { return nil }),
			)

			_, err := runtime.Start(context.Background(), sessions.StartRequest{
				SessionID: "session-1",
				Profile:   profile,
				CPU:       "1",
				Memory:    "2g",
				Pids:      128,
				Network:   "notebook-internal",
			})

			if err != nil {
				t.Fatalf("start runtime: %v", err)
			}
			if len(runner.commands) != 1 {
				t.Fatalf("commands = %d, want 1", len(runner.commands))
			}
			args := runner.commands[0].args
			if got := args[len(args)-1]; got != image {
				t.Fatalf("docker image = %q, want %q", got, image)
			}
		})
	}
}

func TestDockerRuntimeStopForceRemovesContainer(t *testing.T) {
	runner := &recordingRunner{outputs: [][]byte{[]byte("true kernel-broker\n"), nil}}
	runtime := NewDockerRuntime(runner, Images{})

	if err := runtime.Stop(context.Background(), "container-1"); err != nil {
		t.Fatalf("stop runtime: %v", err)
	}
	if len(runner.commands) != 2 {
		t.Fatalf("commands = %d, want managed-label inspect then removal", len(runner.commands))
	}
	command := runner.commands[1]
	if command.name != "docker" || !slices.Equal(command.args, []string{"rm", "--force", "container-1"}) {
		t.Fatalf("stop command = %q %#v, want docker rm --force container-1", command.name, command.args)
	}
}

func TestDockerRuntimeRefusesUnmanagedContainer(t *testing.T) {
	runner := &recordingRunner{output: []byte("true other-controller\n")}
	runtime := NewDockerRuntime(runner, Images{})

	if err := runtime.Stop(context.Background(), "database"); err == nil || !strings.Contains(err.Error(), "not managed") {
		t.Fatalf("stop unmanaged error = %v, want refusal", err)
	}
	if len(runner.commands) != 1 || slices.Contains(runner.commands[0].args, "rm") {
		t.Fatalf("commands = %#v, unmanaged container must not be removed", runner.commands)
	}
}

func TestDockerRuntimeAliveRequiresManagedLabel(t *testing.T) {
	managed := NewDockerRuntime(&recordingRunner{output: []byte("true kernel-broker\n")}, Images{})
	if !managed.Alive(context.Background(), "container-1") {
		t.Fatal("running managed container reported dead")
	}
	unmanaged := NewDockerRuntime(&recordingRunner{output: []byte("true other-controller\n")}, Images{})
	if unmanaged.Alive(context.Background(), "database") {
		t.Fatal("unmanaged container reported alive")
	}
}

func TestDockerRuntimeRemovesOnlyStaleNotebookSessionContainers(t *testing.T) {
	runner := &recordingRunner{output: []byte("container-1\ncontainer-2\n")}
	runtime := NewDockerRuntime(runner, Images{})

	if err := runtime.RemoveStaleContainers(context.Background()); err != nil {
		t.Fatalf("remove stale containers: %v", err)
	}
	if len(runner.commands) != 2 {
		t.Fatalf("commands = %d, want 2", len(runner.commands))
	}
	if command := runner.commands[0]; command.name != "docker" || !slices.Equal(command.args, []string{
		"ps", "--all", "--quiet", "--filter", "label=notebook.managed-by=kernel-broker",
	}) {
		t.Fatalf("list command = %q %#v, want label-scoped docker ps", command.name, command.args)
	}
	if command := runner.commands[1]; command.name != "docker" || !slices.Equal(command.args, []string{
		"rm", "--force", "container-1", "container-2",
	}) {
		t.Fatalf("remove command = %q %#v, want force removal of listed containers", command.name, command.args)
	}
}

func TestDockerRuntimeSkipsRemovalWhenNoStaleContainersExist(t *testing.T) {
	runner := &recordingRunner{}
	runtime := NewDockerRuntime(runner, Images{})

	if err := runtime.RemoveStaleContainers(context.Background()); err != nil {
		t.Fatalf("remove stale containers: %v", err)
	}
	if len(runner.commands) != 1 {
		t.Fatalf("commands = %d, want only label-scoped docker ps", len(runner.commands))
	}
}
