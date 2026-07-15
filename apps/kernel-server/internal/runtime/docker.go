package runtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

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
	runner     CommandRunner
	images     Images
	readyCheck ReadyCheck
	hostProxy  bool
}

type ReadyCheck func(context.Context, string, string) error

const jupyterReadyTimeout = 2 * time.Minute

type DockerRuntimeOption func(*DockerRuntime)

func WithReadyCheck(readyCheck ReadyCheck) DockerRuntimeOption {
	return func(runtime *DockerRuntime) {
		runtime.readyCheck = readyCheck
	}
}

// WithHostProxy publishes each runtime only on loopback. It exists for local
// development, where kernel-server runs on the host and cannot resolve Docker
// network DNS names. Production kernel-server runs inside the private network.
func WithHostProxy() DockerRuntimeOption {
	return func(runtime *DockerRuntime) {
		runtime.hostProxy = true
	}
}

func NewDockerRuntime(runner CommandRunner, images Images, options ...DockerRuntimeOption) *DockerRuntime {
	if runner == nil {
		runner = execRunner{}
	}
	runtime := &DockerRuntime{
		runner:     runner,
		images:     images,
		readyCheck: waitForJupyter,
	}
	for _, option := range options {
		option(runtime)
	}
	return runtime
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
	}
	if !r.hostProxy {
		args = append(args, "--network", request.Network)
	}
	args = append(args,
		"--read-only",
		"--tmpfs", "/tmp:rw,noexec,nosuid,size=256m,mode=1777",
		"--tmpfs", "/home/jovyan/.cache:rw,nosuid,size=256m,mode=1777",
		"--tmpfs", "/home/jovyan/.config:rw,nosuid,size=128m,mode=1777",
		"--tmpfs", "/home/jovyan/.ipython:rw,nosuid,size=128m,mode=1777",
		"--tmpfs", "/home/jovyan/.jupyter:rw,nosuid,size=128m,mode=1777",
		"--tmpfs", "/home/jovyan/.local:rw,nosuid,size=256m,mode=1777",
		"--tmpfs", "/home/jovyan/work:rw,nosuid,size=512m,mode=1777",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"--pids-limit", strconv.Itoa(request.Pids),
		"--cpus", request.CPU,
		"--memory", request.Memory,
		"--user", "1000:100",
		"--label", "notebook.session="+request.SessionID,
		"--name", request.SessionID,
		"--env", "JUPYTER_TOKEN="+token,
	)
	if r.hostProxy {
		args = append(args, "--publish", "127.0.0.1::8888")
	}
	args = append(args, image)
	output, err := r.runner.Run(ctx, "docker", args...)
	if err != nil {
		return sessions.RuntimeHandle{}, fmt.Errorf("docker run: %w: %s", err, strings.TrimSpace(string(output)))
	}
	containerID := strings.TrimSpace(string(output))
	if containerID == "" {
		return sessions.RuntimeHandle{}, fmt.Errorf("docker run returned an empty container ID")
	}
	handle := sessions.RuntimeHandle{
		ID:       containerID,
		Endpoint: "http://" + request.SessionID + ":8888",
		Token:    token,
	}
	if r.hostProxy {
		endpoint, err := r.hostEndpoint(ctx, containerID)
		if err != nil {
			return sessions.RuntimeHandle{}, r.cleanupStartFailure(ctx, containerID, err)
		}
		handle.Endpoint = endpoint
	}
	if err := r.readyCheck(ctx, handle.Endpoint, handle.Token); err != nil {
		return sessions.RuntimeHandle{}, r.cleanupStartFailure(ctx, handle.ID, fmt.Errorf("wait for Jupyter runtime: %w", err))
	}
	return handle, nil
}

func (r *DockerRuntime) cleanupStartFailure(ctx context.Context, containerID string, cause error) error {
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if cleanupErr := r.Stop(cleanupCtx, containerID); cleanupErr != nil {
		return fmt.Errorf("%w; cleanup failed: %v", cause, cleanupErr)
	}
	return cause
}

func (r *DockerRuntime) hostEndpoint(ctx context.Context, containerID string) (string, error) {
	output, err := r.runner.Run(ctx, "docker", "port", containerID, "8888/tcp")
	if err != nil {
		return "", fmt.Errorf("resolve published Jupyter port: %w: %s", err, strings.TrimSpace(string(output)))
	}
	address := strings.TrimSpace(strings.Split(string(output), "\n")[0])
	if address == "" {
		return "", fmt.Errorf("resolve published Jupyter port: docker returned an empty address")
	}
	return "http://" + address, nil
}

func waitForJupyter(ctx context.Context, endpoint, token string) error {
	// Data-science images may need more than a minute for a cold start on
	// Docker Desktop. Keep this bounded, but do not reject a healthy sandbox
	// before Jupyter has finished importing its runtime dependencies.
	readyCtx, cancel := context.WithTimeout(ctx, jupyterReadyTimeout)
	defer cancel()

	client := &http.Client{Timeout: 3 * time.Second}
	for {
		req, err := http.NewRequestWithContext(readyCtx, http.MethodGet, endpoint+"/api/status", nil)
		if err != nil {
			return fmt.Errorf("create readiness request: %w", err)
		}
		req.Header.Set("Authorization", "token "+token)
		response, err := client.Do(req)
		if err == nil {
			_, _ = io.Copy(io.Discard, response.Body)
			response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return nil
			}
		}

		select {
		case <-readyCtx.Done():
			if err != nil {
				return fmt.Errorf("Jupyter did not become ready: %w", readyCtx.Err())
			}
			return fmt.Errorf("Jupyter did not become ready: last status %s", response.Status)
		case <-time.After(250 * time.Millisecond):
		}
	}
}

func (r *DockerRuntime) Alive(ctx context.Context, containerID string) bool {
	output, err := r.runner.Run(ctx, "docker", "inspect", "--format", "{{.State.Running}}", containerID)
	return err == nil && strings.TrimSpace(string(output)) == "true"
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
