import { redirect } from "next/navigation"

import { NotionWorkspace } from "@workspace/core"
import { notionApi } from "@workspace/core/notion/api/notion.api"

import { getAuthToken, getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"

import {
  archive,
  create,
  getById,
  getChildren,
  getSearch,
  getTrash,
  move,
  remove,
  removeCoverImage,
  removeIcon,
  reorder,
  restore,
  update,
  uploadFile,
} from "../actions"

export const metadata = { title: "Notion editor" }

// The workspace tree is edited live — never cache against the latest writes.
export const dynamic = "force-dynamic"

/** "css-grid-lab" → "Css grid lab" as a starter title for a fresh root doc. */
function titleFromSlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1) || "Untitled"
}

/**
 * Notion editor for a "notion" article slug. Reached from a roadmap notion
 * node — admins land here to author the document tree, while web visitors get
 * the read-only /notion/[slug] viewer (same shared component). Mirrors the
 * jupyter /notebooks editor precedent.
 */
export default async function AdminNotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)
  const token = await getAuthToken()

  // Root doc = the roadmap CHAPTER (A1). Auto-created on first admin visit.
  // authorId is set server-side from the token, so the client no longer sends it.
  let doc = await notionApi.getBySlug(slug, token)
  if (!doc) {
    doc = await notionApi
      .create({ slug, title: titleFromSlug(slug) }, token)
      // Unique-slug race (two admins' first visit): the loser refetches.
      .catch(() => notionApi.getBySlug(slug, token))
    if (!doc) redirect(FORBIDDEN_PATH)
  }

  // Deep-link to an article page under this chapter (?page=<article-slug>).
  // Auto-create its child doc when the article node exists on the canvas but
  // has no doc yet (article authored in the builder, not the notion sidebar).
  let initialSelectedId: string | undefined
  if (page && page !== slug) {
    let pageDoc = await notionApi.getBySlug(page, token)
    if (!pageDoc) {
      pageDoc = await notionApi
        .create(
          { slug: page, parentDocumentId: doc.id, title: titleFromSlug(page) },
          token
        )
        .catch(() => notionApi.getBySlug(page, token))
    }
    initialSelectedId = pageDoc?.id
  }

  return (
    <NotionWorkspace
      root={doc}
      canEdit
      publicOrigin={process.env.NEXT_PUBLIC_HOST_URL}
      initialSelectedId={initialSelectedId}
      roadmapChapterSlug={slug}
      roadmapRole={role}
      actions={{
        getById,
        getChildren,
        create,
        update,
        archive,
        restore,
        remove,
        getTrash,
        getSearch,
        reorder,
        move,
        removeIcon,
        removeCoverImage,
        uploadFile,
      }}
    />
  )
}
