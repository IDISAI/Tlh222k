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
- **Roadmap integration:** roadmap nodes get optional `contentType?: "notion" | "jupyter"`
  and `notebookSlug?: string | null`. On node click in the web roadmap page, if
  `contentType === "jupyter"` → navigate to `/learn/[notebookSlug]` instead of opening the
  Notion drawer. (Integration seam already exists: `InteractiveRoadmap` exposes
  `onNodeClick(node)` and `apps/web/app/roadmap/[slug]/roadmap-detail-client.tsx` owns the
  handler — only the app layer decides.) Admin apps route jupyter nodes to the editor.
- **Backend `apps/kernel-server`:** Fastify (NOT NestJS). Notebook CRUD (filesystem store v1,
  repository interface so Prisma can swap in later), Jupyter Server proxy + WebSocket bridge,
  Clerk JWT auth: only admin/super-admin can start kernels or execute; web can only GET
  published notebooks. Env: `JUPYTER_URL`, `JUPYTER_TOKEN` (server-side only), document in
  `docs/onboarding/env.md`.

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

apps/kernel-server/ (Fastify)
  src/{index,config}.ts, plugins/auth.ts (Clerk JWT + requireAdmin),
  routes/{notebooks,kernels,kernel-ws}.ts,
  services/{jupyter.service,notebook-store}.ts, storage/notebooks/ (gitignored except fixtures)

apps/web:   app/learn/[slug]/page.tsx (+ client component), lib/notebook.ts,
            fixtures: content/notebooks/arithmetic-and-variables{,.exercise}.ipynb
apps/admin, apps/super-admin: app/notebooks/page.tsx + app/notebooks/[id]/page.tsx, lib/notebook.ts
```

## Phases

Each must end CI-green: `pnpm lint && pnpm typecheck && pnpm build` (no test runner exists).

1. **Viewer** — core types/service/utils/viewer + web /learn/[slug] + fixtures + roadmap
   jupyter-node integration. Exercise tab shows placeholder. Acceptance: fixture renders like
   Kaggle Learn screenshot incl. red ANSI traceback, TOC scroll-spy highlights active section,
   Start Exercise card switches tab, jupyter mock node in roadmap navigates to /learn/....
2. **Editor UI + CRUD** — editor components + Fastify kernel-server (notebooks CRUD, auth) +
   admin/super-admin pages. Run buttons disabled ("kernel: Phase 3"). Acceptance: full cell
   editing + shortcuts + autosave round-trips valid nbformat 4; non-admin token → 403.
3. **Execution** — KernelAdapter + both implementations + kernels/WS routes + ExerciseView
   replacing web placeholder. Acceptance (admin): streamed output line-by-line for
   `for i in range(5): print(i); time.sleep(1)`, In [*]→In [1], interrupt/restart, reconnect,
   stdin. Acceptance (web): Pyodide runs print/pandas, q1.check() shows ✅/❌, DevTools Network
   shows zero execution requests; non-admin kernel API → 403.

## Current progress (branch feat/jupyter-notebook-kaggle)

Already written (Phase 1, in parent repo, NOT committed yet):
- `packages/core/src/notebook/types.ts`, `notebook.service.ts`,
  `utils/{ansi,highlight,nbformat,slugify,index}.ts`, `viewer/components/MarkdownCell.tsx`

Remaining for Phase 1: CodeCell, OutputRenderer, CellRenderer, TableOfContents,
StartExerciseCard, NotebookView, useActiveHeading, viewer/notebook barrels, src/index.ts export,
web page + lib/notebook.ts + 2 .ipynb fixtures, roadmap submodule fields + mock node + app wiring.

## Repo facts (verified — trust these)

- Feature-first convention per `packages/core/src/roadmap`: types.ts, `<slug>.service.ts`, hooks/,
  components/, utils/, index.ts barrels re-exported up to src/index.ts (moduleResolution: Bundler).
- **Submodules:** `packages/ui` and `packages/core/src/roadmap` are separate git repos. The roadmap
  change (RoadmapNode optional fields + mock node in mock/nodes.mock.ts + nothing else) must be
  committed in the submodule repo first, then bump the gitlink in the parent. `notebook/` lives in
  the parent core repo. Do not commit inside `packages/ui`.
- RoadmapNode today: `{ id, roadmapId, parentId, title, notionPageId, positionX, positionY,
  order, status }` — no type field yet. Mocks in roadmap/mock/nodes.mock.ts (BaseNode + withStatus).
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
