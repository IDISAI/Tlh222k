import { FieldCms } from "@/components/fields/field-cms"
import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import { redirect } from "next/navigation"

export default async function FieldsPage() { const role = await getRole(); if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH); return <FieldCms role={role} /> }
