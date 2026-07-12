package runtime

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/lh222k/kernel-server/internal/sessions"
)

type recordedCommand struct {
	name string
	args []string
}

type recordingRunner struct {
	commands []recordedCommand
	output   []byte
	err      error
}

func (r *recordingRunner) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	r.commands = append(r.commands, recordedCommand{name: name, args: slices.Clone(args)})
	return r.output, r.err
}

func TestDockerRuntimeStartUsesLockedDownRunArguments(t *testing.T) {
	runner := &recordingRunner{output: []byte("container-1\n")}
	runtime := NewDockerRuntime(runner, Images{
		DataScience: "local/notebook-data-science:dev",
		MLCPU:       "local/notebook-ml-cpu:dev",
	})

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
		"--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
		"--tmpfs", "/home/jovyan:rw,nosuid,size=512m",
		"--cap-drop", "ALL", "--security-opt", "no-new-privileges",
		"--pids-limit", "128", "--cpus", "1", "--memory", "2g",
		"--user", "1000:100", "--label", "notebook.session=session-1",
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
	runtime := NewDockerRuntime(runner, Images{DataScience: "data-image", MLCPU: "ml-image"})

	_, err := runtime.Start(context.Background(), sessions.StartRequest{Profile: "custom"})
	if err == nil || !strings.Contains(err.Error(), "unsupported runtime profile") {
		t.Fatalf("start error = %v, want unsupported profile", err)
	}
	if len(runner.commands) != 0 {
		t.Fatalf("commands = %d, want 0", len(runner.commands))
	}
}

func TestDockerRuntimeStopForceRemovesContainer(t *testing.T) {
	runner := &recordingRunner{}
	runtime := NewDockerRuntime(runner, Images{})

	if err := runtime.Stop(context.Background(), "container-1"); err != nil {
		t.Fatalf("stop runtime: %v", err)
	}
	if len(runner.commands) != 1 {
		t.Fatalf("commands = %d, want 1", len(runner.commands))
	}
	command := runner.commands[0]
	if command.name != "docker" || !slices.Equal(command.args, []string{"rm", "--force", "container-1"}) {
		t.Fatalf("stop command = %q %#v, want docker rm --force container-1", command.name, command.args)
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
		"ps", "--all", "--quiet", "--filter", "label=notebook.session",
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
