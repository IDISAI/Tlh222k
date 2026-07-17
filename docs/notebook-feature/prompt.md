# Build: Jupyter Notebook feature (Kaggle Learn style) — 3 phases

> Self-contained build spec for the `feat/jupyter-notebook-kaggle` branch.
> Companion file: [phases.md](phases.md) — ASCII UI mockups for verifying each phase.

## Goal

Two-tier Jupyter notebook feature in this Turborepo (pnpm, Node ≥20):

- **`apps/web` (port 3000, regular users):** page `/learn/[slug]` with **2 tabs: Tutorial | Exercise**.
  - *Tutorial* = read-only rendered notebook (Kaggle Learn style): markdown cells, code
    cells with `In [n]:` prompts + Python syntax highlight, outputs (stream /
    execute_result / display_data / error-traceback with red background + ANSI colors),
    sticky right-hand TOC with scroll-spy, floating "Your turn — [Not now] [Start Exercise]"
    card that switches to the Exercise tab.
  - *Exercise* = editable copy of a companion exercise notebook, executed **client-side via
    Pyodide in a Web Worker** (no server execution for regular users), with learntools-style
    `q1.check()` grading (pure-Python checker shipped with the notebook) and a progress bar.
    Lazy boot: show "Session off (run a cell to start)", boot Pyodide on first run (~3-5s spinner).
- **`apps/admin` (3002) + `apps/super-admin` (3003):** `/notebooks` list + `/notebooks/[id]`
  full Colab-style editor: CodeMirror 6 cells, add/delete/move/duplicate/change-type,
  keyboard shortcuts (Shift+Enter run-advance, Ctrl+Enter, A/B insert, DD delete, M/Y type,
  Ctrl+Z undo), autosave ("Draft saved"), upload/download .ipynb, and **live kernel execution
  against a real Jupyter Server** (status indicator idle/busy/reconnecting, `In [*]`,
  real-time streamed outputs, Run All / Interrupt / Restart, stdin input() support).
- **Roadmap integration — NO NEW FIELDS NEEDED (model already exists as of commit #9).**
  `RoadmapNode` already has `nodeType: "role" | "skill" | "chapter" | "article"` (4-level
  hierarchy), and **article leaves already carry `articleType: "notion" | "jupyter"` +
  `jupyterUrl: string | null`**. The rule: on node click in the web roadmap page, if
  `node.nodeType === "article" && node.articleType === "jupyter"` → open OUR internal notebook
  viewer at `/learn/[slug]` instead of the Notion drawer. (Seam exists: `InteractiveRoadmap`
  exposes `onNodeClick(node)`; `apps/web/app/roadmap/[slug]/roadmap-detail-client.tsx` owns the
  handler — only the app layer decides.) A mock jupyter node already exists in
  `roadmap/mock/nodes.mock.ts`.
  **✅ DECIDED — route by `jupyterUrl` shape:**
  - `jupyterUrl` is an **absolute URL** (starts with `http://`/`https://`, e.g. a Colab link)
    → open it externally (new tab / external link), current behavior preserved.
  - `jupyterUrl` is **empty/null or a relative value** → open the INTERNAL viewer at
    `/learn/[node.slug]`.
  Implement as a small helper, e.g. `resolveArticleTarget(node): { kind: "external", url } |
  { kind: "internal", slug }`, used by the web roadmap click handler. Reuse the existing
  `roadmap/utils/is-valid-url.ts` to detect absolute URLs. No schema change.
  **✅ ALSO DECIDED — internal target is ROLE-aware (not just viewer):** an internal jupyter
  article opens a different destination per zone, threaded via `notebookBasePath` on
  `NodeDetailDialog`/`RoadmapViewer` (default `/learn`):
  - web (viewers) → `/learn/[slug]` (read-only viewer)
  - admin/super-admin (creators) → `/notebooks/[slug]` (the EDITOR, to create/update)
  Builder canvas + admin roadmap view pass `/notebooks`; web passes nothing (default `/learn`).
  Also: the builder's `NodeEditPanel` no longer REQUIRES `jupyterUrl` for jupyter articles —
  an empty URL is what selects the internal notebook, so requiring it made the internal path
  unreachable (that was the reported "integration doesn't work" bug).
- **Backend `apps/kernel-server`:** **Go** (single long-running binary, NOT Node/Fastify, NOT
  a Vercel serverless function — deploy on Fly/Railway/VPS). Jobs: (1) notebook CRUD (filesystem
  store v1, repository interface so Postgres can swap in later), (2) auth gate — verify Clerk JWT
  via the Clerk JWKS endpoint + `requireAdmin`, (3) authenticating **WebSocket reverse-proxy**
  bridging the browser to a real Jupyter Server. Only admin/super-admin can start kernels or
  execute; web can only GET published notebooks. Env: `JUPYTER_URL`, `JUPYTER_TOKEN`,
  `CLERK_JWKS_URL`/`CLERK_ISSUER` (all server-side only), document in `docs/onboarding/env.md`.

  **Why Go:** the backend's core job is holding many long-lived WebSocket connections and
  fanning messages between browser and kernels — Go's goroutine-per-connection model fits this,
  and a single static binary is the easiest stateful deploy (solves "can't run on Vercel"). The
  frontend never knows or cares: it talks to kernel-server over HTTP/WS, so the language is
  invisible across the `KernelAdapter` seam.

**Explicitly out of scope:** Data tab / Kaggle API integration (former Phase 4 — dropped),
realtime collaboration, GPU, scheduling.

## Architecture decisions (settled — do not relitigate)

- **KernelAdapter interface** (`kernel/types.ts`) is the load-bearing seam: `NotebookEditor`
  never imports Jupyter or Pyodide directly; it receives an adapter via context/props.
  Two implementations: `jupyter/jupyter-adapter.ts` (uses `@jupyterlab/services` → kernel-server,
  admin only) and `pyodide/pyodide-adapter.ts` (Web Worker, regular users).
- Editor UI is shared between admin editor and web Exercise tab — only the adapter differs.
- Syntax highlight: hand-rolled Python regex tokenizer (no shiki/prism dep). ANSI: hand-rolled
  SGR parser (no ansi_up dep). Markdown: react-markdown (already a core dep).
- Editor: CodeMirror 6. Kernel client (admin): @jupyterlab/services. Ask before any other heavy dep.
- **kernel-server = Go**, but it treats notebooks as **opaque `.ipynb` bytes** (store/serve only,
  no parsing). All nbformat parsing/validation stays in the TS `NotebookService`, run on both the
  frontend and Next.js server components. This is why the Go backend needs no shared types — the
  `types.ts` model lives only in TS, and duplicating it in Go structs is deliberately avoided.
- The backend is an authenticating **WS passthrough**: the browser's `@jupyterlab/services`
  speaks the Jupyter protocol end-to-end *through* the proxy; Go only checks auth then relays
  frames. Go does NOT implement the Jupyter messaging protocol itself.

## Directory layout (agreed)

```
packages/core/src/notebook/
  types.ts                 # nbformat v4 + normalized models  [DONE]
  notebook.service.ts      # parse/serialize/extractToc       [DONE]
  utils/{ansi,highlight,nbformat,slugify,index}.ts            [DONE]
  viewer/  components/{NotebookView,CellRenderer,MarkdownCell[DONE],CodeCell,
           OutputRenderer,TableOfContents,StartExerciseCard}.tsx
           hooks/useActiveHeading.ts, index.ts
  editor/  components/{NotebookEditor,EditorToolbar,EditableCell,CodeCellEditor,
           MarkdownCellEditor,CellOutputArea,KernelStatusIndicator}.tsx
           hooks/{useNotebookEditor,useCellExecution,useKeyboardShortcuts}.ts
           editor.service.ts   # pure cell mutations, no React
  kernel/  types.ts (KernelAdapter), jupyter/jupyter-adapter.ts,
           pyodide/{pyodide-adapter.ts,pyodide.worker.ts,learntools/checker.py},
           hooks/useKernel.ts
  exercise/ types.ts, exercise.service.ts, components/ExerciseView.tsx
  index.ts barrel; add `export * from "./notebook"` to packages/core/src/index.ts

apps/kernel-server/ (Go — separate module, NOT in the pnpm workspace)
  go.mod, cmd/server/main.go
  internal/config/      # env loading + validation
  internal/auth/        # Clerk JWT verify via JWKS, requireAdmin middleware
  internal/notebooks/   # CRUD handlers + Store interface + fsStore (opaque .ipynb bytes)
  internal/kernels/     # kernel session lifecycle (start/interrupt/restart/shutdown, idle-reap)
  internal/proxy/       # authenticating WebSocket reverse-proxy → Jupyter Server
  storage/notebooks/    # .ipynb blobs (gitignored except fixtures)
  .env.example
  Note: add a Go build/lint step to CI separate from the pnpm lint→typecheck→build chain.

apps/web:   app/learn/[slug]/page.tsx (+ client component), lib/notebook.ts,
            fixtures: content/notebooks/arithmetic-and-variables{,.exercise}.ipynb
apps/admin, apps/super-admin: app/notebooks/page.tsx + app/notebooks/[id]/page.tsx, lib/notebook.ts
```

## Phases

Each must end CI-green: `pnpm lint && pnpm typecheck && pnpm build` (no test runner exists).

1. **Viewer** — core types/service/utils/viewer + web /learn/[slug] + fixtures + roadmap
   jupyter-node integration (use EXISTING `nodeType==="article" && articleType==="jupyter"`;
   no schema change). Exercise tab shows placeholder. Acceptance: fixture renders like Kaggle
   Learn screenshot incl. red ANSI traceback, TOC scroll-spy highlights active section, Start
   Exercise card switches tab, clicking the mock jupyter article node routes to /learn/....
2. **Editor UI + CRUD** — editor components + Fastify kernel-server (notebooks CRUD, auth) +
   admin/super-admin pages. Run buttons disabled ("kernel: Phase 3"). Acceptance: full cell
   editing + shortcuts + autosave round-trips valid nbformat 4; non-admin token → 403.
3. **Execution** — KernelAdapter + both implementations + kernels/WS routes + ExerciseView
   replacing web placeholder. Acceptance (admin): streamed output line-by-line for
   `for i in range(5): print(i); time.sleep(1)`, In [*]→In [1], interrupt/restart, reconnect,
   stdin. Acceptance (web): Pyodide runs print/pandas, q1.check() shows ✅/❌, DevTools Network
   shows zero execution requests; non-admin kernel API → 403.

## Known limits & risks (fold into acceptance — do not skip)

- **[Phase 1, security] Sanitize `display_data`/`execute_result` HTML output.** A notebook's
  `text/html` output can carry `<script>`/event handlers → XSS in our origin. Sanitize (or
  sandbox-iframe) before rendering any html mime output. Fixtures are benign, so this is easy
  to forget — it is not optional.
- **[Phase 1, perf] Cap cell render + output size.** If a code cell exceeds ~2000 lines / ~50KB,
  skip the regex tokenizer and render plain `<pre>` (avoids main-thread freeze + regex
  backtracking). Truncate any single output to ~5000 lines / ~1MB with a "show more"/download
  affordance. Reject absurd cells (> a few MB) at parse time with `NotebookParseError`.
- **[Phase 3, security — DEPLOY BLOCKER] Sandbox the Jupyter kernel before any non-local deploy.**
  Executed code runs with the kernel process's privileges (filesystem, network, env secrets).
  "Admin-only" is not sufficient isolation. Localhost + token is fine for dev; production
  requires containerized/sandboxed per-session kernels with resource limits. Never enable real
  execution on a shared/production host without this.
- **[Phase 3, resource] Kernel idle-reap.** Kernels are stateful and never self-terminate. Track
  session ownership and shut down idle kernels, or kernel-server leaks RAM until it dies.
- **[Phase 3, safety] Pyodide watchdog timeout.** An infinite loop hangs the user's worker;
  enforce an execution timeout that terminates/reboots the worker.
- **[infra] Filesystem store is dev-only.** kernel-server must be a long-running server (not
  Vercel serverless) because it needs a persistent filesystem + live WebSockets + a Jupyter
  process. The `Store` interface exists so Postgres can replace fsStore later.
- **[content] learntools `q1.check()` is a hand-rolled mini-checker.** It only grades simple
  variable/output comparisons; real Kaggle `learntools` notebooks are NOT drop-in compatible.
  Exercise authors must write against our checker.

## Current progress (working on branch `develop`)

**Phase 1 (Viewer) — COMPLETE** (uncommitted on develop as of 2026-07-09):
- Core: `types.ts`, `notebook.service.ts` (+ parse-time cell-size cap, TocEntry.cellId),
  `utils/{ansi,highlight,nbformat,slugify,sanitize-html,index}.ts`, full `viewer/`
  (MarkdownCell, CodeCell, OutputRenderer, CellRenderer, TableOfContents,
  StartExerciseCard, NotebookView, useActiveHeading, barrels). `export * from "./notebook"`
  in src/index.ts — NOTE: notebook barrel re-exports utils by NAME because notebook's
  `slugify` collides with roadmap's at the top barrel (`export *` would silently drop both).
- Security/perf limits implemented: html outputs sanitized client-side post-mount
  (whitelist DOMParser sanitizer, text/plain fallback during SSR), >2000-line/50KB cells
  skip the tokenizer, outputs truncated at 5000 lines/1MB with "Show more", >3MB cells
  rejected with NotebookParseError.
- Web: `app/learn/[slug]/{page,learn-client}.tsx`, `lib/notebook.ts` (slug-validated fs
  loader), fixtures `content/notebooks/arithmetic-and-variables{,.exercise}.ipynb`
  (incl. ANSI NameError traceback + pandas-style html table), `outputFileTracingIncludes`
  for the fixtures in next.config.ts.
- Roadmap routing: `roadmap/utils/resolve-article-target.ts` wired into
  `nodeNavigationUrl` (NodeDetailDialog); mock (`fe-ar-arith`) + db seed both carry an
  internal jupyter node slug `arithmetic-and-variables` (jupyterUrl null → /learn/...).
  Caveat: on the standalone admin dev origin (:3002) /learn 404s (web-zone route); in
  prod the host domain serves both zones so the link resolves correctly.

**Phase 2 (Editor UI) — v1 COMPLETE & CI-green** (typecheck + lint 0-err + `pnpm -F admin build`
+ `pnpm -F web build` all pass):
- Fixed the reported "roadmap integration" bug: `NodeEditPanel` no longer REQUIRES `jupyterUrl`
  for jupyter articles (empty URL = internal notebook; requiring it made the internal path
  unreachable). URL now validated only when provided.
- Role-aware routing: `nodeNavigationUrl(node, notebookBasePath)` + `notebookBasePath` prop on
  `NodeDetailDialog`/`RoadmapViewer`. web → `/learn/[slug]` (viewer), admin/super-admin →
  `/notebooks/[slug]` (editor). Builder canvas + admin roadmap page pass `/notebooks`. Internal
  links now open same-tab; only external (Colab/Notion) open a new tab.
- `notebook/editor/`: `editor.service.ts` (pure cell ops: insert/delete/move/duplicate/
  changeType/updateSource + emptyNotebook), `store.ts` (`NotebookStore` + `LocalNotebookStore`),
  `hooks/useNotebookEditor.ts` (state + debounced autosave), `components/{NotebookEditor,
  EditorToolbar,EditableCell,CodeCellEditor,MarkdownCellEditor}.tsx`. Barrels + `export * from
  "./editor"` in notebook/index.ts. Cells are textarea-based v1; Run disabled.
- Admin route `apps/admin/app/notebooks/[slug]/page.tsx` (role-guarded) → `NotebookEditor`.

**Phase 2 backend (Go kernel-server) — DONE & running.** `apps/kernel-server` (standalone Go
module, stdlib only, NOT in pnpm/turbo workspace; `go build`/`go vet` clean, CRUD smoke-tested
on :3006). Notebook CRUD over a filesystem store (opaque `.ipynb` bytes + `.meta.json`),
`DEV_AUTH_ROLE` bypass + Clerk JWKS RS256 verification, `RequireAdmin` on mutating routes,
public `/api/published/{slug}` for web, CORS for the three zones. Wired:
- core `HttpNotebookStore` (editor/store.ts); `NotebookEditor` picks it when
  `NEXT_PUBLIC_KERNEL_SERVER_URL` is set, else `LocalNotebookStore`.
- web `lib/notebook.ts` reads `/api/published/{slug}` first, falls back to committed fixtures.
- env: `NEXT_PUBLIC_KERNEL_SERVER_URL` (web+admin), kernel-server `.env.example`. README+AGENTS added.
So admin-authored notebooks now appear on web (closes the localStorage↔fixtures gap).

Phase 2 deferred (next): CodeMirror 6 (replace textarea cells), keyboard shortcuts
(Shift+Enter/A/B/DD/M/Y), super-admin editor parity (route not yet added), and wiring the
admin browser's Clerk token into `HttpNotebookStore.getToken` for production (dev uses the
kernel-server DEV_AUTH_ROLE bypass).

**Phase 3 (execution) — NOT STARTED.** KernelAdapter + Pyodide (web Exercise tab) +
Jupyter-via-Go (admin), replacing the disabled Run buttons + the Exercise-tab placeholder.

## Repo facts (verified — trust these)

- Feature-first convention per `packages/core/src/roadmap`: types.ts, `<slug>.service.ts`, hooks/,
  components/, utils/, index.ts barrels re-exported up to src/index.ts (moduleResolution: Bundler).
- **NO submodules anymore.** `.gitmodules` is gone; `packages/ui` and `packages/core/src/roadmap`
  are now plain inline directories in this one repo (CLAUDE.md "Former Submodules" confirms).
  Everything — notebook/ AND any roadmap edits — is a normal edit + single commit in this repo.
  Ignore all earlier notes about committing inside a submodule / bumping gitlinks.
- **RoadmapNode today (updated by commit #9 "roadmap builder"):**
  `{ id, roadmapId, parentId, title, notionPageId, positionX, positionY, order, status,`
  `  nodeType: "role"|"skill"|"chapter"|"article", slug, description, articleType: "notion"|"jupyter"|null,`
  `  jupyterUrl: string|null, isDeleted? }`. See `roadmap/types.ts`. The jupyter integration
  fields ALREADY EXIST — do not re-add them. Mock jupyter node already in mock/nodes.mock.ts.
- Roadmap now has a full builder (`roadmap/builder/*`), api layer (`roadmap/api/roadmap.api.ts`),
  and generated GraphQL types (`roadmap/graphql/generated.ts`). Admins already set `articleType`
  + `jupyterUrl` per node via the builder's NodeEditPanel — reuse that, don't build node-type UI.
- apps consume core via `"@workspace/core": "workspace:*"` + transpilePackages + tsconfig paths;
  reference: apps/web/lib/core.ts, apps/web/tsconfig.json.
- @workspace/ui has: tabs, button, card, sheet, dialog, dropdown-menu, input, textarea, badge,
  tooltip, scroll-area, skeleton, separator, select, table, etc. (shadcn-style).
- core deps already include react-markdown ^9, lucide-react; React 19.2.4.
- **Pinned modified Next.js 16.2.6** — docs at
  `node_modules/.pnpm/next@16.2.6_*/node_modules/next/dist/docs/`. Known gotchas: params is a
  Promise (await it); middleware is renamed proxy.ts; Clerk v7 has no SignedIn/SignedOut —
  use `await auth()` server-side (see apps/web/lib/auth.ts: getIsAuthenticated/getRole);
  role comes from sessionClaims metadata (normalized, see lib/auth.ts); localStorage reads
  must happen in post-mount useEffect (hydration); Multi-Zone: admin basePath only in prod.
- Web page pattern to copy: apps/web/app/roadmap/[slug]/page.tsx (async params, service in
  server component, client component for interactivity).
- Markdown styling reference: roadmap/drawer/components/MarkdownContent.tsx (but notebook viewer
  uses cleaner Kaggle-like styling, already established in viewer/components/MarkdownCell.tsx).

## Working rules

- Vietnamese for discussion with the user; code/comments in English matching existing style.
- Never add heavy dependencies beyond: CodeMirror 6 packages, @jupyterlab/services, fastify +
  @fastify/websocket, pyodide (CDN-loaded in worker). Ask first for anything else.
- Verify in browser via preview tools (launch configs exist in .claude/launch.json for
  web :3000, admin :3002, super-admin :3003) and compare against the phase's ASCII mockup.
