"use server"

import { del, put } from "@vercel/blob"

import type {
  CreateDocumentInput,
  NotionDoc,
  UpdateDocumentInput,
} from "@workspace/core"
import { NotionService } from "@workspace/core/notion/notion.service"

import { getRole, getUserId } from "@/lib/auth"

// Every action re-resolves the caller's role from the Clerk session and hands
// it to the service, which enforces assertCanWrite — the admin proxy and the
// page's getRole() gate are optimistic; THIS is the trust boundary.
const service = new NotionService()

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

export async function getById(id: string): Promise<NotionDoc | null> {
  return service.getById(await getRole(), id)
}

export async function getChildren(
  parentDocumentId: string
): Promise<NotionDoc[]> {
  return service.getChildren(await getRole(), parentDocumentId)
}

export async function create(input: CreateDocumentInput): Promise<NotionDoc> {
  const userId = await getUserId()
  return service.create(await getRole(), userId ?? "unknown", input)
}

export async function update(input: UpdateDocumentInput): Promise<NotionDoc> {
  return service.update(await getRole(), input)
}

/**
 * Cross-service title sync (QĐ-2): a roadmap node rename pushes its new title
 * to the Document with the same slug. Best-effort — no-op if no doc is linked.
 */
export async function syncTitleBySlug(
  slug: string,
  title: string
): Promise<void> {
  const role = await getRole()
  const doc = await service.getBySlug(role, slug)
  if (doc) await service.update(role, { id: doc.id, title })
}

/** "css-grid-lab" → "Css grid lab" as a starter title for a fresh root doc. */
function titleFromSlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1) || "Untitled"
}

/**
 * Auto-create the Document backing a new notion article node with the SAME
 * slug (join key) — notion-article-node Req 2.1/2.2. The doc is parented
 * under the chapter's ROOT doc (A1 model) so it shows up in the workspace
 * sidebar tree; the root is auto-created here when the admin never opened
 * the chapter workspace before. Returns null on failure so the canvas can
 * leave the node unlinked instead of throwing.
 */
export async function createDocumentForNode(
  slug: string,
  title: string,
  parentChapterSlug?: string
): Promise<{ id: string } | null> {
  const userId = await getUserId()
  const role = await getRole()
  const authorId = userId ?? "unknown"
  try {
    let parentDocumentId: string | undefined
    if (parentChapterSlug) {
      let root = await service.getBySlug(role, parentChapterSlug)
      if (!root) {
        root = await service
          .create(role, authorId, {
            slug: parentChapterSlug,
            title: titleFromSlug(parentChapterSlug),
          })
          // Unique-slug race: the loser refetches.
          .catch(() => service.getBySlug(role, parentChapterSlug))
      }
      parentDocumentId = root?.id
    }
    const doc = await service.create(role, authorId, {
      slug,
      title,
      parentDocumentId,
    })
    return { id: doc.id }
  } catch {
    return null
  }
}

/**
 * Publish-state sync from a notion article node to its linked Document
 * (`notionPageId` = Document.id) — notion-article-node Req 7. Missing
 * documents are skipped silently (Req 7.3).
 */
export async function syncPublishByNotionPageId(
  notionPageId: string,
  isPublished: boolean
): Promise<void> {
  const role = await getRole()
  const doc = await service.getById(role, notionPageId)
  if (!doc) return
  await service.update(role, { id: notionPageId, isPublished })
}

/**
 * Archive the Document linked to a permanently-deleted notion article node —
 * notion-article-node Req 8.2. Missing documents are a no-op.
 */
export async function archiveByNotionPageId(
  notionPageId: string
): Promise<void> {
  const role = await getRole()
  const doc = await service.getById(role, notionPageId)
  if (!doc) return
  await service.archive(role, notionPageId)
}

export async function archive(id: string): Promise<void> {
  await service.archive(await getRole(), id)
}

export async function restore(id: string): Promise<void> {
  await service.restore(await getRole(), id)
}

export async function remove(id: string): Promise<void> {
  await service.remove(await getRole(), id)
}

export async function getTrash(): Promise<NotionDoc[]> {
  return service.getTrash(await getRole())
}

export async function getSearch(): Promise<NotionDoc[]> {
  return service.getSearch(await getRole())
}

export async function reorder(
  parentDocumentId: string,
  orderedIds: string[]
): Promise<void> {
  await service.reorder(await getRole(), parentDocumentId, orderedIds)
}

/** Drag-to-nest: re-parent a doc in the sidebar tree (null = top level). */
export async function move(
  id: string,
  parentDocumentId: string | null
): Promise<NotionDoc> {
  return service.move(await getRole(), id, parentDocumentId)
}

export async function removeIcon(id: string): Promise<NotionDoc> {
  return service.removeIcon(await getRole(), id)
}

export async function removeCoverImage(id: string): Promise<NotionDoc> {
  const role = await getRole()
  const doc = await service.getById(role, id)
  const updated = await service.removeCoverImage(role, id)
  // Best-effort blob cleanup — an orphaned file must not fail the action.
  if (doc?.coverImage) await del(doc.coverImage).catch(() => {})
  return updated
}

/** Cover images + BlockNote file blocks → Vercel Blob (public). */
export async function uploadFile(form: FormData): Promise<{ url: string }> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") {
    throw new Error("PERMISSION_DENIED")
  }
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("NO_FILE")
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("FILE_TOO_LARGE")
  }
  const blob = await put(`notion/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
  })
  return { url: blob.url }
}
