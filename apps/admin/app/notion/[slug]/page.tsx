import { redirect } from "next/navigation"

import { NotionWorkspace } from "@workspace/core"
import { NotionService } from "@workspace/core/notion/notion.service"
import { auth } from "@clerk/nextjs/server"

import { getRole } from "@/lib/auth"
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

const service = new NotionService()

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
  const { userId } = await auth()
  const authorId = userId ?? "unknown"

  // Root doc = the roadmap CHAPTER (A1). Auto-created on first admin visit.
  let doc = await service.getBySlug(role, slug)
  if (!doc) {
    doc = await service
      .create(role, authorId, { slug, title: titleFromSlug(slug) })
      // Unique-slug race (two admins' first visit): the loser refetches.
      .catch(() => service.getBySlug(role, slug))
    if (!doc) redirect(FORBIDDEN_PATH)
  }

  // Deep-link to an article page under this chapter (?page=<article-slug>).
  // Auto-create its child doc when the article node exists on the canvas but
  // has no doc yet (article authored in the builder, not the notion sidebar).
  let initialSelectedId: string | undefined
  if (page && page !== slug) {
    let pageDoc = await service.getBySlug(role, page)
    if (!pageDoc) {
      pageDoc = await service
        .create(role, authorId, {
          slug: page,
          parentDocumentId: doc.id,
          title: titleFromSlug(page),
        })
        .catch(() => service.getBySlug(role, page))
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
