"use client"

import { useAuth } from "@clerk/nextjs"
import { NotebookEditor } from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"

export function NotebookEditorClient({ slug }: { slug: string }) {
  // Dev bypass skips <ClerkProvider> (see app/layout.tsx), so useAuth would
  // throw. Route around Clerk entirely in that mode.
  const isDev =
    devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE) !==
    null
  return isDev ? (
    <NotebookEditor slug={slug} getToken={async () => "dev-token"} />
  ) : (
    <ClerkNotebookEditorClient slug={slug} />
  )
}

function ClerkNotebookEditorClient({ slug }: { slug: string }) {
  const { getToken } = useAuth()
  return <NotebookEditor slug={slug} getToken={getToken} />
}
