import { redirect } from "next/navigation"

import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"

import { NotionCmsClient } from "./notion-cms-client"

export const metadata = { title: "Tài liệu" }
export const dynamic = "force-dynamic"

export default async function NotionIndexPage() {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  return <NotionCmsClient />
}
