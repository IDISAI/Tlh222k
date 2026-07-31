import { redirect } from "next/navigation"
import { requireCmsRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { NotebooksIndexClient } from "./notebooks-client"

export const metadata = { title: "Notebooks" }

/** Notebook management: list, create, delete, publish state. */
export default async function AdminNotebooksPage() {
  const role = await requireCmsRole()

  return <NotebooksIndexClient />
}
