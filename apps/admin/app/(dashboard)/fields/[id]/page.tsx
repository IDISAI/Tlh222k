import { FieldWorkspace } from "@/components/fields/field-workspace"
import { requireCmsRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { redirect } from "next/navigation"

export default async function FieldWorkspacePage({ params }: { params: Promise<{ id: string }> }) { const role = await requireCmsRole(); const { id } = await params; return <FieldWorkspace id={id} role={role} /> }
