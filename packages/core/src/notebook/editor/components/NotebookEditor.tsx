"use client"

import { useMemo } from "react"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { NotebookService } from "../../notebook.service"
import type { NotebookRecord } from "../../kernel/types"
import { JupyterSandboxAdapter, SandboxSessionClient } from "../../kernel"
import { useNotebookRuntime } from "../../runtime/use-notebook-runtime"
import {
  HttpNotebookStore,
  LocalNotebookStore,
  type NotebookStore,
} from "../store"
import { useNotebookEditor } from "../hooks/useNotebookEditor"
import { EditableCell } from "./EditableCell"
import { EditorToolbar } from "./EditorToolbar"

interface NotebookEditorProps {
  slug: string
  /** Persistence backend; defaults to kernel-server (if configured) else localStorage. */
  store?: NotebookStore
  /** Server-provided starting notebook; omit to load from the store on mount. */
  initial?: NotebookRecord | null
  /** Supplies a Clerk session JWT for kernel-server's admin write routes. */
  getToken?: () => Promise<string | null>
}

const service = new NotebookService()

// Shared with the web viewer: when set, notebooks live on kernel-server so the
// admin editor and the web /learn viewer read/write the same store.
const KERNEL_SERVER_URL = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL

/**
 * Colab-style notebook editor (Phase 2): edit markdown/code cells, restructure,
 * autosave. Execution (Run) is disabled until Phase 3 wires a KernelAdapter.
 */
export function NotebookEditor({
  slug,
  store,
  initial,
  getToken,
}: NotebookEditorProps) {
  const notebookStore = useMemo<NotebookStore>(
    () =>
      store ??
      (KERNEL_SERVER_URL
        ? new HttpNotebookStore(KERNEL_SERVER_URL, getToken)
        : new LocalNotebookStore()),
    [store, getToken]
  )
  const editor = useNotebookEditor(slug, notebookStore, initial)
  const snapshot = useMemo(() => editor.snapshot(), [editor.cells, editor.title])
  const adapter = useMemo(
    () => KERNEL_SERVER_URL && getToken
      ? new JupyterSandboxAdapter(
          new SandboxSessionClient(KERNEL_SERVER_URL, getToken),
          "data-science"
        )
      : null,
    [getToken]
  )
  const runtime = useNotebookRuntime(snapshot, adapter)

  const handleDownload = () => {
    const raw = service.serialize(editor.snapshot())
    const blob = new Blob([JSON.stringify(raw, null, 1)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slug}.ipynb`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (editor.loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      <div className="px-4 pt-4">
        <input
          value={editor.title}
          onChange={(e) => editor.setTitle(e.target.value)}
          className="w-full bg-transparent text-xl font-bold outline-none"
          placeholder="Notebook title"
        />
      </div>

      <EditorToolbar
        saveState={editor.saveState}
        onAddCode={() => editor.insert(editor.selectedId, "below", "code")}
        onAddMarkdown={() =>
          editor.insert(editor.selectedId, "below", "markdown")
        }
        onDownload={handleDownload}
        onRunAll={
          adapter ? () => void runtime.runAll().catch(() => undefined) : undefined
        }
        running={runtime.status === "busy" || runtime.status === "starting"}
        published={editor.meta.published}
        onTogglePublish={() => editor.setPublished(!editor.meta.published)}
      />

      {editor.error && (
        <p role="alert" className="px-4 text-sm text-destructive">
          {editor.error} Changes remain dirty and can be retried.
        </p>
      )}

      {runtime.error && (
        <p role="alert" className="px-4 text-sm text-destructive">
          {runtime.error}
        </p>
      )}

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-2 overflow-y-auto p-4">
        {editor.cells.map((cell) => (
          <EditableCell
            key={cell.id}
            cell={cell}
            selected={editor.selectedId === cell.id}
            onSelect={() => editor.select(cell.id)}
            onChange={(source) => editor.edit(cell.id, source)}
            onToggleType={(type) => editor.setType(cell.id, type)}
            onMove={(direction) => editor.move(cell.id, direction)}
            onDuplicate={() => editor.duplicate(cell.id)}
            onDelete={() => editor.remove(cell.id)}
            runtime={runtime.cells[cell.id]}
            onRun={cell.cellType === "code"
              ? () => void runtime.runCell(cell.id).catch(() => undefined)
              : undefined}
          />
        ))}

        <div className="flex justify-center pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.insert(null, "below", "code")}
          >
            <Plus className="size-4" /> Thêm cell
          </Button>
        </div>
      </div>
    </div>
  )
}
