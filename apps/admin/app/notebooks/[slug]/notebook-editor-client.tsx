"use client"

import { useAuth } from "@clerk/nextjs"
import { NotebookEditor } from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"

type NotebookEditorClientProps = {
  slug: string
  defaultTitle?: string
}

/** Browser auth boundary. Core stays Clerk-independent. */
export function NotebookEditorClient(props: NotebookEditorClientProps) {
  // Dev bypass skips <ClerkProvider> (see app/layout.tsx), so useAuth would
  // throw. Route around Clerk entirely in that mode.
  const isDev =
    devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE) !==
    null
  return isDev ? (
    <NotebookEditorInner {...props} getToken={async () => "dev-token"} />
  ) : (
    <ClerkNotebookEditorClient {...props} />
  )
}

function ClerkNotebookEditorClient(props: NotebookEditorClientProps) {
  const { getToken } = useAuth()
  return <NotebookEditorInner {...props} getToken={getToken} />
}

function NotebookEditorInner({
  slug,
  defaultTitle,
  getToken,
}: NotebookEditorClientProps & {
  getToken: () => Promise<string | null>
}) {
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
