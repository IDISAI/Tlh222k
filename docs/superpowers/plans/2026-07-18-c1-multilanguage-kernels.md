# C1 Multi-language Kernel Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute per-notebook Python, JavaScript, C++, Java, Rust, Go, and Julia notebooks through fixed Jupyter profiles while preserving Python's browser fallback.

**Architecture:** A typed TypeScript language registry owns notebook/profile/kernel mappings. A matching Go profile package validates API and broker input and selects fixed Docker images. Editor/viewer behavior consumes the registry; Compose exposes opt-in per-language runtime builds.

**Tech Stack:** TypeScript 5.9, React 19, CodeMirror 6, Vitest, Go stdlib, Docker Compose, Jupyter kernels.

## Global Constraints

- Work only in `C:\tmp\lh222k-main` on `codex/feat-multilanguage-notebooks-visualize-execution`.
- Next.js is pinned to 16.2.6; read installed client-component and worker guidance before changing app code.
- One language per notebook; never add per-cell language metadata.
- Apps may import packages; packages never import apps.
- Kernel-server remains Go stdlib only and treats `.ipynb` bytes as opaque.
- Python keeps `data-science` and `ml-cpu`; other languages map one-to-one to profiles.
- Without kernel-server, only normalized language `python` may execute through Pyodide.
- Runtime images remain opt-in builds; ordinary Compose startup must not build all seven images.

---

## File Structure

- `packages/core/src/notebook/kernel/languages.ts`: typed language/profile/kernel registry and lookup functions.
- `packages/core/src/notebook/kernel/languages.test.ts`: mapping and unknown-language behavior.
- `packages/core/src/notebook/notebook.service.test.ts`: nbformat language round-trip.
- `packages/core/src/notebook/utils/highlight.ts`: shared editor/viewer parsers.
- `packages/core/src/notebook/utils/highlight.test.ts`: parser fallback behavior.
- `packages/core/src/notebook/editor/**`: selector and metadata mutation.
- `apps/web/app/notebooks/[slug]/learn-client.tsx`: Jupyter/Pyodide selection and disabled reason.
- `apps/kernel-server/internal/profiles/profiles.go`: server-wide runtime profile allowlist.
- `apps/kernel-server/internal/runtime/docker.go`: profile-to-image selection.
- `apps/kernel-server/compose.yaml`: opt-in image targets and broker env.
- `apps/kernel-server/runtime/Dockerfile`: common Jupyter base plus profile-specific kernels.

### Task 1: Lock TypeScript language and nbformat contracts

**Files:**
- Create: `packages/core/src/notebook/kernel/languages.test.ts`
- Create: `packages/core/src/notebook/notebook.service.test.ts`
- Modify: `packages/core/src/notebook/kernel/languages.ts`
- Modify: `packages/core/src/notebook/kernel/types.ts`
- Modify: `packages/core/src/notebook/notebook.service.ts`
- Modify: `packages/core/src/notebook/kernel/index.ts`

**Interfaces:**
- Produces: `NotebookLanguage`, `LanguageSpec`, `LANGUAGES`, `languageSpec(language): LanguageSpec | undefined`, `profileForNotebook(language, pythonProfile): RuntimeProfile | null`, `kernelNameForProfile(profile): string`.
- Consumes: nbformat `metadata.kernelspec` and `metadata.language_info`.

- [ ] **Step 1: Write failing mapping tests**

```ts
import { describe, expect, it } from "vitest"
import {
  LANGUAGES,
  kernelNameForProfile,
  languageSpec,
  profileForNotebook,
} from "./languages"

const expected = [
  ["python", "data-science", "python3"],
  ["javascript", "javascript", "deno"],
  ["cpp", "cpp", "xcpp17"],
  ["java", "java", "java"],
  ["rust", "rust", "rust"],
  ["go", "go", "gophernotes"],
  ["julia", "julia", "julia"],
] as const

describe("notebook language registry", () => {
  it("maps every supported language to a profile and kernel", () => {
    expect(LANGUAGES).toHaveLength(7)
    for (const [language, profile, kernel] of expected) {
      expect(languageSpec(language)).toMatchObject({ language, profile, kernelName: kernel })
      expect(kernelNameForProfile(profile)).toBe(kernel)
    }
    expect(kernelNameForProfile("ml-cpu")).toBe("python3")
  })

  it("does not execute unknown languages as Python", () => {
    expect(languageSpec("brainfuck")).toBeUndefined()
    expect(profileForNotebook("brainfuck")).toBeNull()
    expect(profileForNotebook("python", "ml-cpu")).toBe("ml-cpu")
  })
})
```

- [ ] **Step 2: Write failing nbformat round-trip test**

```ts
import { describe, expect, it } from "vitest"
import { NotebookService } from "./notebook.service"

describe("NotebookService language metadata", () => {
  it("preserves kernelspec and language_info", () => {
    const service = new NotebookService()
    const parsed = service.parse({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { name: "deno", display_name: "Deno", language: "javascript" },
        language_info: { name: "javascript", version: "2" },
      },
      cells: [],
    })
    expect(parsed.language).toBe("javascript")
    expect(service.serialize(parsed).metadata).toMatchObject({
      kernelspec: { name: "deno", language: "javascript" },
      language_info: { name: "javascript", version: "2" },
    })
  })
})
```

- [ ] **Step 3: Run tests and confirm red**

Run: `pnpm --filter @workspace/core exec vitest run src/notebook/kernel/languages.test.ts src/notebook/notebook.service.test.ts`

Expected: FAIL because unknown languages currently fall back to Python and kernel IDs differ.

- [ ] **Step 4: Implement typed registry and safe lookup**

```ts
export type NotebookLanguage =
  | "python" | "javascript" | "cpp" | "java" | "rust" | "go" | "julia"

export interface LanguageSpec {
  language: NotebookLanguage
  label: string
  profile: RuntimeProfile
  kernelName: string
  displayName: string
}

export function languageSpec(language: string | undefined): LanguageSpec | undefined {
  return LANGUAGES.find((candidate) => candidate.language === language)
}

export function profileForNotebook(
  language: string | undefined,
  pythonProfile: RuntimeProfile = "data-science"
): RuntimeProfile | null {
  const spec = languageSpec(language)
  if (!spec) return null
  if (spec.language !== "python") return spec.profile
  return pythonProfile === "ml-cpu" ? "ml-cpu" : "data-science"
}
```

Use kernel IDs `python3`, `deno`, `xcpp17`, `java`, `rust`, `gophernotes`, and stable Julia alias `julia`.

- [ ] **Step 5: Run tests and confirm green**

Run: `pnpm --filter @workspace/core exec vitest run src/notebook/kernel/languages.test.ts src/notebook/notebook.service.test.ts`

Expected: 2 files pass, 0 failed.

- [ ] **Step 6: Commit contract slice**

```powershell
git add packages/core/src/notebook/kernel/languages.ts packages/core/src/notebook/kernel/languages.test.ts packages/core/src/notebook/kernel/types.ts packages/core/src/notebook/kernel/index.ts packages/core/src/notebook/notebook.service.ts packages/core/src/notebook/notebook.service.test.ts
git commit -m "feat(notebook): define multi-language runtime contracts"
```

### Task 2: Complete editor and viewer language behavior

**Files:**
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/core/src/notebook/editor/components/CodeCellEditor.tsx`
- Modify: `packages/core/src/notebook/editor/components/EditorToolbar.tsx`
- Modify: `packages/core/src/notebook/editor/components/NotebookEditor.tsx`
- Modify: `packages/core/src/notebook/editor/hooks/useNotebookEditor.ts`
- Modify: `packages/core/src/notebook/editor/hooks/useNotebookEditor.test.ts`
- Modify: `packages/core/src/notebook/utils/highlight.ts`
- Create: `packages/core/src/notebook/utils/highlight.test.ts`
- Modify: `packages/core/src/notebook/viewer/components/CodeCell.tsx`

**Interfaces:**
- Consumes: `LANGUAGES` and `languageSpec` from Task 1.
- Produces: selector mutation that rewrites both nbformat fields; `tokenizeCode(code, language)`.

- [ ] **Step 1: Add failing editor mutation test**

```ts
it("rewrites notebook language metadata and runtime profile", async () => {
  const store = storeWith()
  const { result } = renderHook(() => useNotebookEditor("demo", store, null))
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.setLanguage("rust"))
  expect(result.current.language).toBe("rust")
  expect(result.current.record.notebook.metadata).toMatchObject({
    kernelspec: { name: "rust", language: "rust" },
    language_info: { name: "rust" },
  })
  expect(result.current.record.meta.runtimeProfile).toBe("rust")
})
```

- [ ] **Step 2: Add failing highlighter tests**

```ts
import { describe, expect, it } from "vitest"
import { tokenizeCode } from "./highlight"

describe("tokenizeCode", () => {
  it.each(["python", "javascript", "cpp", "java", "rust", "go", "julia"])(
    "returns complete source for %s",
    (language) => {
      const source = "value = 42\n"
      expect(tokenizeCode(source, language).map((token) => token.text).join(""))
        .toBe(source)
    }
  )
  it("falls back to plain text", () => {
    expect(tokenizeCode("hello", "unknown")).toEqual([{ text: "hello", type: "" }])
  })
})
```

- [ ] **Step 3: Run focused tests and confirm red**

Run: `pnpm --filter @workspace/core exec vitest run src/notebook/editor/hooks/useNotebookEditor.test.ts src/notebook/utils/highlight.test.ts`

Expected: FAIL until Julia parser and safe language mutation are wired.

- [ ] **Step 4: Add CodeMirror dependencies**

Run: `pnpm --filter @workspace/core add @codemirror/lang-cpp @codemirror/lang-go @codemirror/lang-java @codemirror/lang-javascript @codemirror/lang-rust @lezer/highlight @plutojl/lang-julia`

Expected: package manifest and lockfile update without peer-dependency failure.

- [ ] **Step 5: Implement one parser registry for editor and viewer**

```ts
const LANGUAGE_EXTENSIONS: Partial<Record<NotebookLanguage, () => Extension>> = {
  python,
  javascript: () => javascript(),
  cpp,
  java,
  rust,
  go,
  julia,
}
```

Use the same language packages in `highlight.ts`; return one plain token for unknown languages and oversized cells.

- [ ] **Step 6: Guard editor mutation**

```ts
setLanguage: (language) => {
  const spec = languageSpec(language)
  if (!spec) return
  markDirty({
    notebook: {
      ...record.notebook,
      language: spec.language,
      metadata: {
        ...record.notebook.metadata,
        kernelspec: {
          name: spec.kernelName,
          display_name: spec.displayName,
          language: spec.language,
        },
        language_info: { ...record.notebook.metadata.language_info, name: spec.language },
      },
    },
    meta: { ...record.meta, runtimeProfile: spec.profile },
  })
}
```

- [ ] **Step 7: Run focused tests and typecheck**

Run: `pnpm --filter @workspace/core exec vitest run src/notebook/editor/hooks/useNotebookEditor.test.ts src/notebook/utils/highlight.test.ts`

Run: `pnpm --filter @workspace/core typecheck`

Expected: all pass.

- [ ] **Step 8: Commit UI language slice**

```powershell
git add packages/core/package.json pnpm-lock.yaml packages/core/src/notebook/editor packages/core/src/notebook/utils/highlight.ts packages/core/src/notebook/utils/highlight.test.ts packages/core/src/notebook/viewer/components/CodeCell.tsx
git commit -m "feat(notebook): add language selection and highlighting"
```

### Task 3: Select browser and Jupyter adapters safely

**Files:**
- Modify: `packages/core/src/notebook/kernel/jupyter-sandbox-adapter.ts`
- Modify: `packages/core/src/notebook/editor/components/NotebookEditor.tsx`
- Modify: `packages/core/src/notebook/runtime/components/InteractiveNotebook.tsx`
- Modify: `apps/web/app/notebooks/[slug]/learn-client.tsx`
- Test: `packages/core/src/notebook/kernel/languages.test.ts`

**Interfaces:**
- Consumes: `profileForNotebook(): RuntimeProfile | null` and `kernelNameForProfile()`.
- Produces: `KernelAdapter | null` selection and user-facing disabled reason.

- [ ] **Step 1: Read pinned Next.js client guidance**

Run: `rtk powershell Get-ChildItem node_modules/.pnpm/next@16.2.6*/node_modules/next/dist/docs -Recurse -File`

Then read matching Client Components and worker-bundling guide files directly.

Expected: identify the installed client-component guide before editing `learn-client.tsx`.

- [ ] **Step 2: Add unknown-language assertions**

Extend `languages.test.ts`:

```ts
expect(profileForNotebook(undefined)).toBeNull()
expect(profileForNotebook("python", "javascript")).toBe("data-science")
```

- [ ] **Step 3: Implement adapter selection**

```ts
function adapterForNotebook(notebook: Notebook): KernelAdapter | null {
  const profile = profileForNotebook(notebook.language, notebookProfile)
  if (!profile) return null
  if (kernelUrl) {
    return new JupyterSandboxAdapter(
      new SandboxSessionClient(kernelUrl, getToken),
      profile
    )
  }
  return notebook.language === "python"
    ? new PyodideKernelAdapter(createWorker)
    : null
}
```

In `JupyterSandboxAdapter.start`, call `manager.startNew({ name: kernelNameForProfile(this.profile) })`.

- [ ] **Step 4: Disable run controls with an explicit reason**

Use `runUnavailableReason` when profile is unknown or a non-Python notebook lacks kernel-server. Disable run-all, run-cell, interrupt, and restart whenever `adapter` is null.

- [ ] **Step 5: Verify focused checks**

Run: `pnpm --filter @workspace/core test`

Run: `pnpm --filter web typecheck`

Expected: pass; Python without kernel-server still constructs Pyodide, JavaScript does not.

- [ ] **Step 6: Commit adapter selection**

```powershell
git add packages/core/src/notebook/kernel packages/core/src/notebook/editor/components/NotebookEditor.tsx packages/core/src/notebook/runtime/components/InteractiveNotebook.tsx apps/web/app/notebooks/[slug]/learn-client.tsx
git commit -m "feat(notebook): route languages to matching kernels"
```

### Task 4: Centralize Go profile validation and image mapping

**Files:**
- Create: `apps/kernel-server/internal/profiles/profiles.go`
- Create: `apps/kernel-server/internal/profiles/profiles_test.go`
- Modify: `apps/kernel-server/internal/store/store.go`
- Modify: `apps/kernel-server/internal/broker/server.go`
- Modify: `apps/kernel-server/internal/broker/server_test.go`
- Modify: `apps/kernel-server/internal/runtime/docker.go`
- Modify: `apps/kernel-server/internal/runtime/docker_test.go`
- Modify: `apps/kernel-server/cmd/docker-broker/main.go`
- Modify: `apps/kernel-server/internal/api/sessions_test.go`

**Interfaces:**
- Produces: `profiles.All`, `profiles.Valid(string) bool`, `runtime.Images map[string]string`.
- Consumes: profile strings only; callers never provide image names.

- [ ] **Step 1: Write failing profile allowlist test**

```go
func TestValid(t *testing.T) {
    for _, profile := range []string{"data-science", "ml-cpu", "javascript", "cpp", "java", "rust", "go", "julia"} {
        if !Valid(profile) { t.Errorf("Valid(%q) = false", profile) }
    }
    if Valid("custom") { t.Fatal("custom profile accepted") }
}
```

- [ ] **Step 2: Extend broker and runtime tests**

Add a table test that posts each profile to `/v1/sessions` and asserts the fixed policy reaches the fake controller. Add a Docker runtime table that asserts each profile selects its configured image and unknown profiles execute zero Docker commands.

- [ ] **Step 3: Run Go tests and confirm red**

Run from `apps/kernel-server`: `go test ./internal/profiles ./internal/store ./internal/broker ./internal/runtime ./internal/api`

Expected: FAIL until shared validation and image mappings exist.

- [ ] **Step 4: Implement shared allowlist**

```go
package profiles

var All = []string{"data-science", "ml-cpu", "javascript", "cpp", "java", "rust", "go", "julia"}

func Valid(value string) bool {
    for _, profile := range All {
        if value == profile { return true }
    }
    return false
}
```

Delegate `store.ValidRuntimeProfile` to `profiles.Valid`; use the same function in broker validation.

- [ ] **Step 5: Replace fixed image struct with map**

```go
type Images map[string]string

func (r *DockerRuntime) imageFor(profile string) (string, error) {
    if !profiles.Valid(profile) {
        return "", fmt.Errorf("unsupported runtime profile %q", profile)
    }
    image := strings.TrimSpace(r.images[profile])
    if image == "" {
        return "", fmt.Errorf("runtime image for profile %q is not configured", profile)
    }
    return image, nil
}
```

- [ ] **Step 6: Run Go tests, vet, and build**

Run: `go test ./...`

Run: `go vet ./...`

Run: `go build ./...`

Expected: all commands exit 0.

- [ ] **Step 7: Commit Go profile slice**

```powershell
git add apps/kernel-server/internal/profiles apps/kernel-server/internal/store apps/kernel-server/internal/broker apps/kernel-server/internal/runtime apps/kernel-server/internal/api/sessions_test.go apps/kernel-server/cmd/docker-broker/main.go
git commit -m "feat(kernel): support language runtime profiles"
```

### Task 5: Add opt-in runtime images and Compose wiring

**Files:**
- Modify: `apps/kernel-server/runtime/Dockerfile`
- Modify: `apps/kernel-server/compose.yaml`
- Modify: `apps/kernel-server/README.md`

**Interfaces:**
- Consumes: profile/image names from Task 4.
- Produces: images containing the exact kernelspec IDs from Task 1.

- [ ] **Step 1: Add Compose services without broker dependencies**

Define `runtime-javascript`, `runtime-cpp`, `runtime-java`, `runtime-rust`, `runtime-go`, and `runtime-julia`. Give each service `profiles: [runtime-<language>]`, a profile build arg, a fixed `local/notebook-<language>:dev` image, and `entrypoint: ["true"]`. Remove runtime services from `docker-broker.depends_on` so startup remains lazy.

- [ ] **Step 2: Wire broker image environment**

Add `JUPYTER_IMAGE_JAVASCRIPT`, `_CPP`, `_JAVA`, `_RUST`, `_GO`, and `_JULIA` with the exact fixed image names consumed by `cmd/docker-broker/main.go`.

- [ ] **Step 3: Install exact kernels in profile branches**

Use these build outcomes:

```text
javascript -> deno jupyter --install --name deno
cpp        -> conda-forge xeus-cling -> xcpp17
java       -> OpenJDK + IJava -> java
rust       -> evcxr_jupyter -> rust
go         -> gophernotes -> gophernotes
julia      -> IJulia plus copied stable alias -> julia
```

End each language build branch with `jupyter kernelspec list --json` and a shell assertion for the expected ID.

- [ ] **Step 4: Validate Compose configuration**

Run from `apps/kernel-server`: `docker compose config --quiet`

Expected: exit 0 and no dependency forces language runtime builds.

- [ ] **Step 5: Build images one at a time**

Run for each language: `docker compose --profile runtime-<language> build runtime-<language>`.

Expected: only requested image builds; `docker run --rm local/notebook-<language>:dev jupyter kernelspec list --json` contains its canonical ID.

- [ ] **Step 6: Document lazy build commands and disk cleanup**

Add exact build, smoke-test, and `docker image rm local/notebook-<language>:dev` commands to `apps/kernel-server/README.md`.

- [ ] **Step 7: Commit runtime images**

```powershell
git add apps/kernel-server/runtime/Dockerfile apps/kernel-server/compose.yaml apps/kernel-server/README.md
git commit -m "feat(kernel): add opt-in language runtime images"
```

### Task 6: C1 integration verification

**Files:**
- Modify only if verification finds a C1 regression.
- Evidence: `artifacts/c1/hello-world-<language>.txt` (untracked local artifacts).

- [ ] **Step 1: Run repository checks**

Run: `pnpm lint`

Run: `pnpm typecheck`

Run: `pnpm test`

Run from `apps/kernel-server`:

```powershell
rtk go test ./...
rtk go vet ./...
rtk go build ./...
```

Expected: every command exits 0.

- [ ] **Step 2: Execute hello-world notebooks**

For each profile, start a session through kernel-server, connect through the proxy, execute a language-appropriate hello world, and save stdout under `artifacts/c1/`.

- [ ] **Step 3: Verify browser fallback**

Unset `NEXT_PUBLIC_KERNEL_SERVER_URL`, open a Python notebook, run `print("python-browser-ok")`, and confirm output. Open a JavaScript notebook and confirm run controls are disabled with the kernel-server message.

- [ ] **Step 4: Review C1 diff and commit verification fixes**

Run: `git diff --check`

Run: `git status --short`

Expected: only intentional source changes and pre-existing generated artifacts remain.
