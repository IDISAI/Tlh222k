import { redirect } from "next/navigation"
import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { NotebookEditorClient } from "./notebook-editor-client"

export const metadata = { title: "Notebook editor" }

/**
 * Notebook editor for a jupyter article slug. Reached from a roadmap jupyter
 * node (articleType "jupyter" with no external URL) — admins land here to
 * create/update the notebook, while web viewers get the read-only /learn viewer.
 * Persistence is the localStorage store (Phase 2 v1); the Go kernel-server
 * replaces it behind NotebookStore later.
 */
export default async function AdminNotebookEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  return <NotebookEditorClient slug={slug} />
}
