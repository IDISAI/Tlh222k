"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  NotebookEditor,
  RoadmapService,
  useTraceEngines,
  type CallerRole,
  type TraceLanguage,
} from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"

/** How long the editor waits on the roadmap for an article's title. */
const SEED_TITLE_TIMEOUT_MS = 3_000

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

  // A notebook reached from a roadmap is described twice, in two services: by
  // its own record, and by its article node. The two seams below keep them
  // saying the same thing, so one publish button and one title mean one thing.
  const roadmap = useMemo(() => new RoadmapService(), [])
  const findArticle = useCallback(
    async (notebookSlug: string) =>
      (await roadmap.listNodes()).find(
        (node) =>
          node.slug === notebookSlug &&
          node.nodeType === "article" &&
          !node.isDeleted
      ) ?? null,
    [roadmap]
  )
  const syncArticlePublish = useCallback(
    async (notebookSlug: string, published: boolean) => {
      const article = await findArticle(notebookSlug)
      if (!article || article.isPublished === published) return
      await roadmap.updateNode(article.id, { isPublished: published }, role)
    },
    [findArticle, roadmap, role]
  )
  const syncArticleTitle = useCallback(
    async (notebookSlug: string, title: string) => {
      const article = await findArticle(notebookSlug)
      if (!article || article.title === title) return
      await roadmap.updateNode(article.id, { title }, role)
    },
    [findArticle, roadmap, role]
  )

  // A brand-new notebook is named the moment it is opened, so the article's own
  // title has to be in hand BEFORE the editor mounts — otherwise the notebook
  // is born "Untitled notebook" and the card it came from disagrees with it.
  // Time-boxed: a roadmap backend that never answers must not hold the editor
  // hostage, so the wait gives up and the notebook opens unnamed instead.
  const [seedTitle, setSeedTitle] = useState<string | undefined>(defaultTitle)
  const [seeding, setSeeding] = useState(defaultTitle === undefined)
  useEffect(() => {
    if (defaultTitle !== undefined) return
    let settled = false
    const stopSeeding = () => {
      if (settled) return
      settled = true
      setSeeding(false)
    }
    const giveUp = setTimeout(stopSeeding, SEED_TITLE_TIMEOUT_MS)
    void findArticle(slug)
      .then((article) => {
        if (!settled && article) setSeedTitle(article.title)
      })
      .catch(() => undefined)
      .finally(stopSeeding)
    return () => {
      settled = true
      clearTimeout(giveUp)
    }
  }, [defaultTitle, findArticle, slug])

  if (seeding) return null

  return (
    <NotebookEditor
      slug={slug}
      getToken={getToken}
      defaultTitle={seedTitle}
      apiBaseUrl={apiBaseUrl}
      createKernelWorker={(language) =>
        language === "javascript"
          ? new Worker(new URL("./javascript-trace.worker.ts", import.meta.url))
          : new Worker(new URL("./pyodide.worker.ts", import.meta.url))
      }
      createTrace={createTrace}
      onPublishChange={syncArticlePublish}
      onTitleChange={syncArticleTitle}
    />
  )
}
