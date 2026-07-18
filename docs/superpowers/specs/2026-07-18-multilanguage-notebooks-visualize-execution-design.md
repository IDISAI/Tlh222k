# Multi-language Notebooks and Visualize Execution Design

## Status

Approved on 2026-07-18 through the supplied EPIC and the explicit request to
begin implementation. This design supersedes the Python-only runtime profile
and remote-runtime-only assumptions in the approved 2026-07-10 Jupyter design.
It retains that design's authentication, session ownership, proxy, resource,
and output-sanitization controls.

## Goal

Allow one notebook to select one of seven languages: Python, JavaScript, C++,
Java, Rust, Go, or Julia. Execute each language through its own Jupyter runtime
image when kernel-server is configured. Preserve the existing Python Pyodide
fallback when kernel-server is absent.

After a successful Python or JavaScript cell run, allow the user to open a
client-side execution visualization with line stepping, variables, stack,
heap, controls, and output. Keep the first release local to web/admin
development; production deployment follows only after local verification.

## Scope Decomposition

Implementation uses four vertical slices:

1. **C1 — multi-language execution:** language metadata, editor selection,
   highlighting, runtime profiles, Docker images, broker validation, and local
   hello-world verification.
2. **C2 — visualization shell:** TOC moves left, visualization panel occupies
   the right side, responsive overlay, active-cell ownership, and button state.
3. **C3 — Python tracing:** bounded Pyodide trace engine and full shared state
   renderer.
4. **C4 — JavaScript tracing:** isolated JS interpreter feeding the same trace
   schema and renderer.

C1 and C2 are independent. C3 depends on C2. C4 depends on the C2 shell and C3
renderer. Implementation order remains C1, C2, C3, C4 so runtime language
selection is stable before tracing is added.

## Approaches Considered

### Chosen: vertical slices around stable public seams

Each child issue reaches a user-visible, verifiable outcome before the next
starts. Existing `KernelAdapter`, `NotebookService`, session API, and notebook
components remain the public seams. This minimizes cross-layer half-states and
makes regressions attributable to one slice.

### Rejected: horizontal backend-then-frontend delivery

Changing all images and broker code before adapting editor/viewer code would
delay feedback and leave profile, kernelspec, and UI mappings inconsistent for
long periods.

### Rejected: one polyglot image or server-side tracing

A polyglot image is large, slow to build, and conflicts with the locked
per-language-image decision. Server-side tracing consumes sandbox capacity and
requires protocol changes; Python and JavaScript tracing can remain free and
client-side.

## C1 Architecture: Multi-language Execution

### Language source of truth

`packages/core/src/notebook/kernel/languages.ts` is the TypeScript registry for
UI labels, normalized nbformat language, runtime profile, and kernel name.
Python retains `data-science` and `ml-cpu`; every other language maps one-to-one
to a profile with the same normalized name.

Notebook language comes from `metadata.language_info.name`, then
`metadata.kernelspec.language`, then defaults to `python`. Changing language in
the editor rewrites both nbformat fields and the runtime profile. Serialization
preserves these metadata fields and old Python notebooks continue to round-trip.

Unknown notebook languages render as plain text and fall back to Python only
for metadata lookup; they must not silently execute through Pyodide as Python.
Execution availability is decided from the original normalized notebook
language.

### Kernel selection

`JupyterSandboxAdapter` derives the kernel name from the selected runtime
profile instead of hardcoding `python3`. Canonical kernel IDs are installed and
tested in each image:

| Language | Profile | Kernel ID |
| --- | --- | --- |
| Python | `data-science`, `ml-cpu` | `python3` |
| JavaScript | `javascript` | `deno` |
| C++ | `cpp` | `xcpp17` |
| Java | `java` | `java` |
| Rust | `rust` | `rust` |
| Go | `go` | `gophernotes` |
| Julia | `julia` | versioned `julia-1.x` with a stable `julia` alias |

The stable Julia alias avoids coupling notebook metadata to a patch/minor image
upgrade. The image build verifies that each configured ID appears in
`jupyter kernelspec list --json`.

### Go validation and image mapping

Kernel-server owns a single allowlist for the eight runtime profiles and uses
it in notebook metadata validation, session creation, and broker requests.
`runtime.Images` maps each profile to a configured image; unknown profiles and
empty image configuration fail before invoking Docker.

The browser never supplies Docker arguments or image names. It supplies only an
allowed profile. Existing fixed CPU, memory, PID, network, read-only filesystem,
capability, ownership, and proxy policies remain unchanged.

### Runtime images and lazy local builds

Each non-Python language has a separate Compose runtime service and image env
variable. Runtime services are opt-in build targets, not dependencies of the
broker, so ordinary `docker compose up` does not build all language images.
Developers build only the profile being exercised. Missing images produce the
existing safe `runtime unavailable` response and actionable broker logs.

The runtime Dockerfile uses profile-specific stages or branches while retaining
the common unprivileged Jupyter server entrypoint. Images install Deno,
xeus-cling, IJava, evcxr, gophernotes, or IJulia as appropriate. No language
toolchain is installed into another language's image.

### Editor and viewer behavior

Editor toolbar exposes one per-notebook language selector. CodeMirror and the
read-only viewer share Lezer-based language highlighting; unsupported grammars
fall back to plain text. Julia uses the community `@plutojl/lang-julia`
CodeMirror 6 package pinned by the workspace lockfile. Package incompatibility
blocks C1 verification instead of silently downgrading Julia highlighting.

With kernel-server configured, all seven languages use Jupyter. Without it,
only Python receives a Pyodide adapter. Non-Python run controls are disabled and
show a kernel-server requirement message. Rendering and editing remain
available.

## C2 Architecture: Layout and Panel Shell

Both static and interactive notebook layouts place the existing sticky TOC on
the left at large breakpoints. The notebook remains the center column. One
`VisualizePanel` occupies the right column. Below `lg`, the panel becomes a
full-screen overlay with an explicit close action.

The notebook host owns `activeVisualizationCellId`, so only one cell can be
active and opening/closing the panel does not recreate notebook runtime state.
Python and JavaScript cells expose **Visualize Execution** after their latest
run completes successfully. Other languages render the same action disabled
with a `coming soon` tooltip.

The shell reserves sections for annotated code, First/Prev/Next/Last,
play/pause, speed, step counter, variables, stack, heap, truncation notice, and
stdout. C2 uses empty-state data; trace engines arrive in C3 and C4.

## C3 Architecture: Python Trace Engine

The Pyodide worker accepts a separate `trace` request. It executes source in a
fresh namespace so visualization cannot read or mutate the normal notebook
session. `sys.settrace` emits a shared serializable schema:

```text
TraceResult {
  steps: TraceStep[]
  truncated: boolean
}

TraceStep {
  line: number
  event: line | call | return | exception
  stack: [{ func, line, locals }]
  heap: object graph
  stdout: string
}
```

Tracing stops by raising a private worker-side exception at 3,000 steps.
Serialization limits nesting to depth 3 and strings to 100 characters. The
worker always returns a terminal response, including truncated and exception
states, so infinite loops cannot leave the UI waiting indefinitely.

Playback is pure React state over the returned JSON. Heap nodes have stable IDs
within a trace; stack/local values reference them. SVG arrows are presentation
only and do not own state.

## C4 Architecture: JavaScript Trace Engine

JavaScript tracing runs in a dedicated Web Worker with no DOM globals.
Babel transpiles supported ES2015+ syntax to ES5 using retained line numbers;
JS-Interpreter executes the result and a `console.log` shim appends stdout.
The worker converts interpreter state into the same `TraceResult` schema used
by Python, including identical caps and truncation behavior.

Unsupported syntax returns a safe trace error without affecting the completed
normal cell output. The renderer and playback controls contain no
language-specific branches.

## Error Handling

- Unknown runtime profiles fail validation with HTTP 400 before Docker starts.
- Missing runtime images produce safe runtime-unavailable UI and detailed local
  server logs without leaking image or host details to learners.
- Missing kernel-server disables only execution, not notebook rendering/editing.
- Trace parse/runtime failures stay inside the visualization panel and do not
  overwrite normal cell output.
- Trace caps show a truncation notice and preserve all collected steps.
- Closing the panel cancels active playback; unmounting a trace worker
  terminates that worker.

## Test Seams and Verification

Tests observe public seams rather than component internals:

- `NotebookService.parse/serialize`: language metadata and round-trip behavior.
- Language registry exports: profile and kernel mapping for all profiles.
- Editor hook/service: language selection rewrites kernelspec,
  `language_info`, and runtime profile.
- Kernel adapter/session client: selected profile starts the expected kernel.
- Go `ValidRuntimeProfile`, session endpoint, broker endpoint, and
  `DockerRuntime.Start`: all allowed profiles map to fixed configured images;
  unknown profiles never invoke Docker.
- Interactive notebook controls: non-Python execution requires kernel-server.
- Trace worker protocols: successful, exception, cap, serialization-depth, and
  stdout behavior.
- Visualize host: one active cell, responsive close, playback boundaries, and
  state preservation.

C1 completion requires Go unit tests, `go vet ./...`, `go build ./...`, focused
TypeScript tests where configured, `pnpm lint`, `pnpm typecheck`, and local
hello-world execution for all seven images. C2-C4 add component/worker checks
and local web/admin browser verification. Production deploy remains excluded.

## Rollback

No data migration is introduced. Revert code/Compose commits and remove only
the explicitly named local runtime images. Existing Python notebook metadata
and Pyodide behavior remain backward compatible.

## Out of Scope

- Production deployment.
- Per-cell language selection.
- Exercise-cell visualization.
- Visualization for C++, Java, Rust, Go, or Julia.
- Persisting or sharing traces.
- `@ignore-function-tree` annotations.
- Package installation from notebook sessions.
