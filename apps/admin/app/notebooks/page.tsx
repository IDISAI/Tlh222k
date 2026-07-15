import { redirect } from "next/navigation"
import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { NotebooksIndexClient } from "./notebooks-client"

export const metadata = { title: "Notebooks" }

/** Notebook management: list, create, delete, publish state. */
export default async function AdminNotebooksPage() {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  return <NotebooksIndexClient />
}
