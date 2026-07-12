package runtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os/exec"
	"strconv"
	"strings"

	"github.com/lh222k/kernel-server/internal/sessions"
)

type CommandRunner interface {
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
}

type Images struct {
	DataScience string
	MLCPU       string
}

func DefaultImages() Images {
	return Images{
		DataScience: "local/notebook-data-science:dev",
		MLCPU:       "local/notebook-ml-cpu:dev",
	}
}

type DockerRuntime struct {
	runner CommandRunner
	images Images
}

func NewDockerRuntime(runner CommandRunner, images Images) *DockerRuntime {
	if runner == nil {
		runner = execRunner{}
	}
	return &DockerRuntime{runner: runner, images: images}
}

func (r *DockerRuntime) Start(ctx context.Context, request sessions.StartRequest) (sessions.RuntimeHandle, error) {
	image, err := r.imageFor(request.Profile)
	if err != nil {
		return sessions.RuntimeHandle{}, err
	}
	token, err := newToken()
	if err != nil {
		return sessions.RuntimeHandle{}, fmt.Errorf("generate Jupyter token: %w", err)
	}

	args := []string{
		"run", "--detach",
		"--network", request.Network,
		"--read-only",
		"--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
		"--tmpfs", "/home/jovyan:rw,nosuid,size=512m",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"--pids-limit", strconv.Itoa(request.Pids),
		"--cpus", request.CPU,
		"--memory", request.Memory,
		"--user", "1000:100",
		"--label", "notebook.session=" + request.SessionID,
		"--name", request.SessionID,
		"--env", "JUPYTER_TOKEN=" + token,
		image,
	}
	output, err := r.runner.Run(ctx, "docker", args...)
	if err != nil {
		return sessions.RuntimeHandle{}, fmt.Errorf("docker run: %w: %s", err, strings.TrimSpace(string(output)))
	}
	containerID := strings.TrimSpace(string(output))
	if containerID == "" {
		return sessions.RuntimeHandle{}, fmt.Errorf("docker run returned an empty container ID")
	}
	return sessions.RuntimeHandle{
		ID:       containerID,
		Endpoint: "http://" + request.SessionID + ":8888",
		Token:    token,
	}, nil
}

func (r *DockerRuntime) Stop(ctx context.Context, containerID string) error {
	output, err := r.runner.Run(ctx, "docker", "rm", "--force", containerID)
	if err != nil {
		return fmt.Errorf("docker rm: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func (r *DockerRuntime) RemoveStaleContainers(ctx context.Context) error {
	output, err := r.runner.Run(ctx, "docker", "ps", "--all", "--quiet", "--filter", "label=notebook.session")
	if err != nil {
		return fmt.Errorf("list stale notebook containers: %w: %s", err, strings.TrimSpace(string(output)))
	}
	containerIDs := strings.Fields(string(output))
	if len(containerIDs) == 0 {
		return nil
	}
	args := append([]string{"rm", "--force"}, containerIDs...)
	output, err = r.runner.Run(ctx, "docker", args...)
	if err != nil {
		return fmt.Errorf("remove stale notebook containers: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func (r *DockerRuntime) imageFor(profile string) (string, error) {
	var image string
	switch profile {
	case "data-science":
		image = r.images.DataScience
	case "ml-cpu":
		image = r.images.MLCPU
	default:
		return "", fmt.Errorf("unsupported runtime profile %q", profile)
	}
	if image == "" {
		return "", fmt.Errorf("runtime image for profile %q is not configured", profile)
	}
	return image, nil
}

func newToken() (string, error) {
	var token [32]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(token[:]), nil
}

type execRunner struct{}

func (execRunner) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}
