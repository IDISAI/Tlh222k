import { FieldCms } from "@/components/fields/field-cms"
import { requireCmsRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { redirect } from "next/navigation"

export default async function FieldsPage() { const role = await requireCmsRole(); return <FieldCms role={role} /> }
