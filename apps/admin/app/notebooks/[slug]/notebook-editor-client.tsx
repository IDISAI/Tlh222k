"use client"

import { useCallback, useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  NotebookEditor,
  RoadmapService,
  useTraceEngines,
  type CallerRole,
  type TraceLanguage,
} from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"

type NotebookEditorClientProps = {
  slug: string
  defaultTitle?: string
}

/**
 * Trace worker entrypoints. Static `new URL(..., import.meta.url)` so the app's
 * bundler emits the chunk; the Worker itself is only constructed on the first
 * "Visualize execution" click. Separate from the execution worker instance, so
 * a trace timeout never terminates the editor's live kernel.
 */
function createTraceWorker(language: TraceLanguage): Worker {
  return language === "python"
    ? new Worker(new URL("./pyodide.worker.ts", import.meta.url))
    : new Worker(new URL("./javascript-trace.worker.ts", import.meta.url))
}

/** Browser auth boundary. Core stays Clerk-independent. */
export function NotebookEditorClient(props: NotebookEditorClientProps) {
  // Dev bypass skips <ClerkProvider> (see app/layout.tsx), so useAuth would
  // throw. Route around Clerk entirely in that mode.
  const isDev =
    devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE) !==
    null
  return isDev ? (
    <NotebookEditorInner
      {...props}
      getToken={async () => "dev-token"}
      role="super-admin"
    />
  ) : (
    <ClerkNotebookEditorClient {...props} />
  )
}

function ClerkNotebookEditorClient(props: NotebookEditorClientProps) {
  const { getToken } = useAuth()
  return <NotebookEditorInner {...props} getToken={getToken} role="admin" />
}

function NotebookEditorInner({
  slug,
  defaultTitle,
  getToken,
  role,
}: NotebookEditorClientProps & {
  getToken: () => Promise<string | null>
  /** Authorizes the roadmap write that keeps the article node in step. */
  role: CallerRole
}) {
  // Multi-zone path: the admin app is served under the web host's /admin prefix
  // in production, so the Blob CRUD API is reached at /admin/api/notebooks; on
  // the admin's own origin (dev) it's /api/notebooks. Resolve at runtime.
  const apiBaseUrl =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin")
      ? "/admin"
      : ""
  const createTrace = useTraceEngines(createTraceWorker)

  // A notebook reached from a roadmap has two publish flags in two services:
  // its own, and its article node's. Publishing here keeps them in step, so the
  // article stops reading "Draft" the moment the notebook goes public.
  const roadmap = useMemo(() => new RoadmapService(), [])
  const syncArticlePublish = useCallback(
    async (notebookSlug: string, published: boolean) => {
      const article = (await roadmap.listNodes()).find(
        (node) =>
          node.slug === notebookSlug &&
          node.nodeType === "article" &&
          !node.isDeleted
      )
      if (!article || article.isPublished === published) return
      await roadmap.updateNode(article.id, { isPublished: published }, role)
    },
    [roadmap, role]
  )

  return (
    <NotebookEditor
      slug={slug}
      getToken={getToken}
      defaultTitle={defaultTitle}
      apiBaseUrl={apiBaseUrl}
      createKernelWorker={(language) =>
        language === "javascript"
          ? new Worker(new URL("./javascript-trace.worker.ts", import.meta.url))
          : new Worker(new URL("./pyodide.worker.ts", import.meta.url))
      }
      createTrace={createTrace}
      onPublishChange={syncArticlePublish}
    />
  )
}
