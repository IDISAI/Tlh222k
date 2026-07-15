"use client"

import { useAuth } from "@clerk/nextjs"
import { NotebookEditor } from "@workspace/core"

/** Browser auth boundary. Core stays Clerk-independent. */
export function NotebookEditorClient({
  slug,
  defaultTitle,
}: {
  slug: string
  defaultTitle?: string
}) {
  const { getToken } = useAuth()

  // Multi-zone path: the admin app is served under the web host's /admin prefix
  // in production, so the Blob CRUD API is reached at /admin/api/notebooks; on
  // the admin's own origin (dev) it's /api/notebooks. Resolve at runtime.
  const apiBaseUrl =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin")
      ? "/admin"
      : ""

  return (
    <NotebookEditor
      slug={slug}
      getToken={getToken}
      defaultTitle={defaultTitle}
      apiBaseUrl={apiBaseUrl}
      createKernelWorker={() =>
        new Worker(new URL("./pyodide.worker.ts", import.meta.url))
      }
    />
  )
}
