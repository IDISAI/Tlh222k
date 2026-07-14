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
  return <NotebookEditor slug={slug} getToken={getToken} defaultTitle={defaultTitle} />
}
