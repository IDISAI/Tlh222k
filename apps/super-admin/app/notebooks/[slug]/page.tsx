import { redirect } from "next/navigation"

import { getRole } from "@/lib/auth"
import { USERS_PATH } from "@/lib/paths"
import { NotebookEditorClient } from "./notebook-editor-client"

export default async function SuperAdminNotebookPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if ((await getRole()) !== "super-admin") redirect(USERS_PATH)
  return <NotebookEditorClient slug={slug} />
}
