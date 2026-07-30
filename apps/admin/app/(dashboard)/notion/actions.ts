"use server"

import { del, put } from "@vercel/blob"

import type {
  CreateDocumentInput,
  NotionDoc,
  UpdateDocumentInput,
} from "@workspace/core"
import { notionApi } from "@workspace/core/notion/api/notion.api"

import { getAuthToken, getRole } from "@/lib/auth"
import { inspectUpload } from "./upload-policy"

// Every action forwards the caller's token (real Clerk token, or the dev:<role>
// bypass in development) to svc-roadmap, which re-checks the role server-side —
// THAT is the trust boundary. uploadFile stays here because it writes to Vercel
// Blob (a Next/runtime concern), returning only a URL saved via the API.

export async function getById(id: string): Promise<NotionDoc | null> {
  return notionApi.getById(id, await getAuthToken())
}

export async function getChildren(
  parentDocumentId: string
): Promise<NotionDoc[]> {
  return notionApi.getChildren(parentDocumentId, await getAuthToken())
}

export async function create(input: CreateDocumentInput): Promise<NotionDoc> {
  return notionApi.create(input, await getAuthToken())
}

export async function update(input: UpdateDocumentInput): Promise<NotionDoc> {
  return notionApi.update(input, await getAuthToken())
}

/**
 * Cross-service title sync: a roadmap node rename pushes its new title to the
 * Document with the same slug. Best-effort — no-op if no doc is linked.
 */
export async function syncTitleBySlug(
  slug: string,
  title: string
): Promise<void> {
  const token = await getAuthToken()
  const doc = await notionApi.getBySlug(slug, token)
  if (doc) await notionApi.update({ id: doc.id, title }, token)
}

/** "css-grid-lab" → "Css grid lab" as a starter title for a fresh root doc. */
function titleFromSlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1) || "Untitled"
}

/**
 * Auto-create the Document backing a new notion article node with the SAME
 * slug (join key), parented under the chapter's ROOT doc. Returns null on
 * failure so the canvas can leave the node unlinked instead of throwing.
 */
export async function createDocumentForNode(
  slug: string,
  title: string,
  parentChapterSlug?: string
): Promise<{ id: string } | null> {
  const token = await getAuthToken()
  try {
    let parentDocumentId: string | undefined
    if (parentChapterSlug) {
      let root = await notionApi.getBySlug(parentChapterSlug, token)
      if (!root) {
        root = await notionApi
          .create(
            {
              slug: parentChapterSlug,
              title: titleFromSlug(parentChapterSlug),
            },
            token
          )
          // Unique-slug race: the loser refetches.
          .catch(() => notionApi.getBySlug(parentChapterSlug, token))
      }
      parentDocumentId = root?.id
    }
    const doc = await notionApi.create({ slug, title, parentDocumentId }, token)
    return { id: doc.id }
  } catch {
    return null
  }
}

/**
 * Publish-state sync from a notion article node to its linked Document
 * (`notionPageId` = Document.id). Missing documents are skipped silently.
 */
export async function syncPublishByNotionPageId(
  notionPageId: string,
  isPublished: boolean
): Promise<void> {
  const token = await getAuthToken()
  let doc = await notionApi.getById(notionPageId, token)
  if (!doc) {
    // If not found by ID, try resolving by slug (chapters/sections use slug mapping)
    doc = await notionApi.getBySlug(notionPageId, token)
  }
  if (!doc) return
  await notionApi.update({ id: doc.id, isPublished }, token)
}

/**
 * Archive the Document linked to a permanently-deleted notion article node.
 * Missing documents are a no-op.
 */
export async function archiveByNotionPageId(
  notionPageId: string
): Promise<void> {
  const token = await getAuthToken()
  const doc = await notionApi.getById(notionPageId, token)
  if (!doc) return
  await notionApi.archive(notionPageId, token)
}

export async function archive(id: string): Promise<void> {
  await notionApi.archive(id, await getAuthToken())
}

export async function restore(id: string): Promise<void> {
  await notionApi.restore(id, await getAuthToken())
}

export async function remove(id: string): Promise<void> {
  await notionApi.remove(id, await getAuthToken())
}

export async function getTrash(): Promise<NotionDoc[]> {
  return notionApi.getTrash(await getAuthToken())
}

export async function getSearch(): Promise<NotionDoc[]> {
  return notionApi.getSearch(await getAuthToken())
}

export async function reorder(
  parentDocumentId: string,
  orderedIds: string[]
): Promise<void> {
  await notionApi.reorder(parentDocumentId, orderedIds, await getAuthToken())
}

/** Drag-to-nest: re-parent a doc in the sidebar tree (null = top level). */
export async function move(
  id: string,
  parentDocumentId: string | null
): Promise<NotionDoc> {
  return notionApi.move(id, parentDocumentId, await getAuthToken())
}

export async function removeIcon(id: string): Promise<NotionDoc> {
  return notionApi.removeIcon(id, await getAuthToken())
}

export async function removeCoverImage(id: string): Promise<NotionDoc> {
  const token = await getAuthToken()
  const doc = await notionApi.getById(id, token)
  const updated = await notionApi.removeCoverImage(id, token)
  // Best-effort blob cleanup — an orphaned file must not fail the action.
  if (doc?.coverImage)
    await del(doc.coverImage, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }).catch(() => {})
  return updated
}

/** Cover images + BlockNote file blocks → Vercel Blob (public). */
export async function uploadFile(form: FormData): Promise<{ url: string }> {
  // Admin gate: uploads never reach svc-roadmap, so enforce the role here.
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") {
    throw new Error("PERMISSION_DENIED")
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new Error("NO_FILE")
  }
  const policy = inspectUpload(file)
  if (!policy.ok) throw new Error(policy.code)

  const blob = await put(
    `notion/${crypto.randomUUID()}-${policy.sanitizedName}`,
    file,
    {
      access: "public",
      contentType: policy.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }
  )
  return { url: blob.url }
}
