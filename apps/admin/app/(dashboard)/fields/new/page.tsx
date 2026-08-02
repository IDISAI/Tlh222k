import { FieldWorkspace } from "@/components/fields/field-workspace"
import { requireCmsRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { redirect } from "next/navigation"

export default async function NewFieldPage() {
  const role = await requireCmsRole()
  return <FieldWorkspace id="new" role={role} />
}
