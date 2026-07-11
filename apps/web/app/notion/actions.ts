"use server"

import type { NotionDoc } from "@workspace/core"
import { NotionService } from "@workspace/core/notion/notion.service"

const service = new NotionService()

// Read-only zone: EVERYONE on web — guest, viewer, even a signed-in admin —
// gets the "viewer" view (published, non-archived documents only). Editing
// lives exclusively in the admin zone; hiding buttons is not the boundary,
// these actions are.
const WEB_ROLE = "viewer" as const

export async function getById(id: string): Promise<NotionDoc | null> {
  return service.getById(WEB_ROLE, id)
}

export async function getChildren(
  parentDocumentId: string
): Promise<NotionDoc[]> {
  return service.getChildren(WEB_ROLE, parentDocumentId)
}
