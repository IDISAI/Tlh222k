# Jupyter Notebook: End-to-End Design

## Status

Approved design. This document describes planned behavior; it is not yet
implemented.

## Goal

Complete the internal Jupyter notebook feature across the public web app,
admin, super-admin, and kernel-server. Published notebooks remain readable by
everyone. Authenticated learners can execute tutorial and exercise cells in an
isolated Jupyter session. Admins and super-admins can author, publish, and run
the same notebooks before release.

The initial deployment target is a small, zero-cost proof of concept on an OCI
Always Free VM. It must not claim to support high-concurrency workloads,
guaranteed GPU access, or deep-learning training at scale.

## Decisions

- Every interactive execution uses a remote Jupyter sandbox. Pyodide is not
  the primary runtime and must not share state with the remote session.
- One sandbox belongs to one authenticated Clerk user and cannot be accessed by
  any other user.
- A learner may read published notebooks anonymously, but must authenticate
  before creating a runtime session or running a cell.
- Notebooks have a server-managed runtime profile: `data-science` or
  `ml-cpu`. Images contain approved dependencies; sessions cannot install
  packages from the network.
- The free-tier default is two active sessions globally, one CPU and 2 GiB RAM
  per session, 15 minutes of inactivity before cleanup, and a retryable
  capacity error when full. The free-tier service does not maintain a queue.
- Sandbox files and execution outputs are ephemeral. Notebook source,
  metadata, publication state, and authored output continue to use the
  existing notebook store. Runtime output is not automatically written back to
  a notebook.
- Existing `UserProgress` and roadmap APIs record learning state: first run
  sets `in_progress`; all successful exercise checks set `done`.

## User Flows

### Public web

1. A visitor opens `/learn/[slug]` and reads a published tutorial without
   authentication.
2. Selecting Run on a tutorial cell, Run all, or an Exercise cell asks an
   anonymous visitor to sign in.
3. The authenticated browser asks kernel-server to allocate or resume the
   caller's session for the selected profile.
4. The browser connects only to a kernel-server proxy. It never receives a
   Jupyter token or a direct container address.
5. The cell streams stdout, stderr, display output, errors, and the execution
   counter into the notebook UI. Users may interrupt or restart only their own
   session.
6. Exercise `qN.check()` results update the exercise progress UI and the
   existing roadmap status.

### Admin and super-admin

1. Both zones expose `/notebooks` and `/notebooks/[slug]` behind their existing
   role checks.
2. Editors create or upload notebooks, edit cells, choose a runtime profile,
   run/interrupt/restart cells, autosave source, download `.ipynb`, and
   publish or unpublish.
3. The component implementation lives in `@workspace/core`; app routes supply
   Clerk token retrieval and zone-specific authorization only.
4. Only admin and super-admin roles may mutate notebook records. Both roles
   may use runtime sessions, subject to the same operational resource limits.

## Architecture

```text
web / admin / super-admin
  -> @workspace/core Notebook UI + JupyterSandboxAdapter
  -> kernel-server (Clerk auth, quota, session ownership, REST/WS proxy)
  -> per-user Jupyter container on a private Docker network

kernel-server
  -> existing filesystem notebook store

web Exercise grades
  -> existing roadmap progress API -> UserProgress
```

### Core package

`JupyterSandboxAdapter` implements the existing `KernelAdapter` interface. It
uses `@jupyterlab/services` to speak the normal Jupyter REST and kernel
WebSocket protocol through kernel-server. Viewer, exercise, and editor
components depend only on the adapter interface, so they never import Jupyter
transport code directly.

The existing Pyodide adapter and worker may remain as an explicitly separate
future offline fallback, but the production paths select the remote adapter.

### Kernel-server

The Go server gains a session manager and a container runtime abstraction. The
Docker implementation creates a locked-down container for each session,
creates a kernel inside it, tracks the owner/profile/last activity, and reaps
idle or stopped containers. Its public API is limited to the following logical
operations:

- `POST /api/sessions` - allocate or resume the caller's session.
- `GET /api/sessions/{id}` - read session state and remaining quota.
- `POST /api/sessions/{id}/interrupt` and `/restart` - control the caller's
  kernel.
- `DELETE /api/sessions/{id}` - terminate the caller's session.
- authenticated HTTP and WebSocket proxy paths for the session's Jupyter API.

The proxy verifies ownership on every request, resolves the internal container
endpoint server-side, and forwards the Jupyter protocol unchanged. A proven Go
WebSocket library is an intentional exception to the current stdlib-only rule;
correct binary frame handling, cancellation, and protocol negotiation are
security-critical here.

### Runtime images and Compose

Docker Compose defines kernel-server, a private internal network, persistent
notebook storage, and build targets for two images:

- `data-science`: Python, NumPy, pandas, SciPy, scikit-learn, matplotlib, and
  the course grading shim.
- `ml-cpu`: the data-science stack plus CPU-only deep-learning libraries for
  small demonstrations.

The OCI VM runs this Compose stack directly. Web-facing apps point at its
HTTPS kernel-server URL. No Jupyter port is publicly exposed.

## Security and Resource Controls

- Clerk JWT verification is mandatory for session and proxy routes. Existing
  dev-role bypass remains development-only.
- Containers run as an unprivileged user with read-only root filesystem,
  temporary writable directories, dropped Linux capabilities, no privilege
  escalation, PID/CPU/memory limits, and a per-cell execution timeout.
- Containers are reachable only over Docker's internal network by
  kernel-server. No public ports, host paths, secrets, or Docker socket are
  exposed to a sandbox.
- Runtime images are immutable and package installation is disabled. The
  internal network has no outbound egress.
- The session manager enforces global and per-user caps, clears all state on
  restart/expiry, and records no executable code or user data beyond normal
  request logs.
- HTML display output passes through the existing sanitizer before rendering.

## Failure Behavior

- Missing authentication prompts sign-in and does not allocate a container.
- Capacity exhaustion shows a retryable quota message and does not queue
  unbounded work.
- Startup, proxy, or kernel failure moves the UI to an error state with a safe
  retry/restart action; raw infrastructure details are not shown to learners.
- Interrupt stops the active execution; restart discards all session variables
  and output remains visible only in the client until navigation.
- A stale WebSocket reconnects through kernel-server and rechecks ownership.

## Verification

- Go tests cover authorization, ownership isolation, profile validation, quota
  enforcement, expiry cleanup, and proxy rejection paths.
- TypeScript tests cover adapter message mapping, UI state transitions,
  exercise grade-to-progress updates, and role-specific route guards.
- Compose smoke tests create a session, execute code, stream output, interrupt,
  restart, expire the session, and confirm no public Jupyter endpoint exists.
- Security smoke tests assert container limits, no host bind mounts, no outbound
  network from the sandbox, and cross-user session access is rejected.
- Required repository checks remain `go vet ./...`, `go build ./...`, `pnpm
  lint`, `pnpm typecheck`, and `pnpm build`.

## Acceptance Criteria

- Published notebooks render for anonymous visitors in the web app.
- Signed-in web learners can run tutorial and exercise cells in their own
  sandbox, including output, errors, interrupt, restart, and grading progress.
- Admin and super-admin can list, edit, execute, publish, unpublish, upload,
  and download notebooks through their respective zones.
- A learner cannot access another learner's session, an admin-only notebook
  mutation, a Jupyter token, a public Jupyter port, host files, or network
  egress from a sandbox.
- The Compose stack and OCI deployment guide run the small free-tier profile
  with documented capacity limits.
