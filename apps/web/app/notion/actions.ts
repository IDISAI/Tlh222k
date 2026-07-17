"use server"

import type { NotionDoc } from "@workspace/core"
import { notionApi } from "@workspace/core/notion/api/notion.api"

// Read-only zone: EVERYONE on web — guest, viewer, even a signed-in admin —
// gets the "viewer" view (published, non-archived docs only). We send NO token,
// so svc-roadmap resolves the caller as a guest and returns published content
// only. The server enforces it, not the UI.
export async function getById(id: string): Promise<NotionDoc | null> {
  return notionApi.getById(id, null)
}

export async function getChildren(
  parentDocumentId: string
): Promise<NotionDoc[]> {
  return notionApi.getChildren(parentDocumentId, null)
}
