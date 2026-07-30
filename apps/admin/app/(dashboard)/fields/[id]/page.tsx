import { FieldWorkspace } from "@/components/fields/field-workspace"
import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { redirect } from "next/navigation"

export default async function FieldWorkspacePage({ params }: { params: Promise<{ id: string }> }) { const role = await getRole(); if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH); const { id } = await params; return <FieldWorkspace id={id} role={role} /> }
