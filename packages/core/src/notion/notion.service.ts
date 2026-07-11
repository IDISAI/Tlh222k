// SERVER-ONLY: imports the Prisma client. Import via
// `@workspace/core/notion/notion.service` from Server Actions / Server
// Components — never from the client barrel (./index.ts excludes this file).
import { prisma, type Document } from "@workspace/db"

import {
  NotionServiceError,
  type CallerRole,
  type CreateDocumentInput,
  type NotionDoc,
  type UpdateDocumentInput,
} from "./types"

const canWrite = (role: CallerRole): boolean =>
  role === "admin" || role === "super-admin"

/** Every write requires admin | super-admin — same gate as roadmap.service. */
function assertCanWrite(callerRole: CallerRole): void {
  if (!canWrite(callerRole)) {
    throw new NotionServiceError("PERMISSION_DENIED")
  }
}

const toDoc = (d: Document): NotionDoc => ({
  id: d.id,
  slug: d.slug,
  title: d.title,
  authorId: d.authorId,
  isArchived: d.isArchived,
  parentDocumentId: d.parentDocumentId,
  content: d.content,
  coverImage: d.coverImage,
  icon: d.icon,
  isPublished: d.isPublished,
  position: d.position,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
})

/**
 * Notion-workspace domain service. Every method takes the CALLER's role first;
 * viewers only ever see published, non-archived documents. Trust boundary is
 * here (server), not the UI's `canEdit` flag.
 */
export class NotionService {
  /** Root doc for a roadmap article slug. Viewers: published only. */
  async getBySlug(callerRole: CallerRole, slug: string): Promise<NotionDoc | null> {
    const doc = await prisma.document.findUnique({ where: { slug } })
    if (!doc || doc.isArchived) return null
    if (!canWrite(callerRole) && !doc.isPublished) return null
    return toDoc(doc)
  }

  /** Published-or-admin gate (spec: getById = published OR admin/super-admin). */
  async getById(callerRole: CallerRole, id: string): Promise<NotionDoc | null> {
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) return null
    if (!canWrite(callerRole) && !(doc.isPublished && !doc.isArchived)) {
      return null
    }
    return toDoc(doc)
  }

  async getChildren(
    callerRole: CallerRole,
    parentDocumentId: string
  ): Promise<NotionDoc[]> {
    const docs = await prisma.document.findMany({
      where: {
        parentDocumentId,
        isArchived: false,
        ...(canWrite(callerRole) ? {} : { isPublished: true }),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })
    return docs.map(toDoc)
  }

  async create(
    callerRole: CallerRole,
    authorId: string,
    input: CreateDocumentInput
  ): Promise<NotionDoc> {
    assertCanWrite(callerRole)
    const parentDocumentId = input.parentDocumentId ?? null
    const position = await prisma.document.count({
      where: { parentDocumentId },
    })
    const doc = await prisma.document.create({
      data: {
        title: input.title?.trim() || "Untitled",
        slug: input.slug ?? null,
        authorId,
        parentDocumentId,
        position,
      },
    })
    return toDoc(doc)
  }

  async update(
    callerRole: CallerRole,
    input: UpdateDocumentInput
  ): Promise<NotionDoc> {
    assertCanWrite(callerRole)
    const { id, ...fields } = input
    try {
      const doc = await prisma.document.update({
        data: {
          ...(fields.title !== undefined ? { title: fields.title } : {}),
          ...(fields.content !== undefined ? { content: fields.content } : {}),
          ...(fields.icon !== undefined ? { icon: fields.icon } : {}),
          ...(fields.coverImage !== undefined
            ? { coverImage: fields.coverImage }
            : {}),
          ...(fields.isPublished !== undefined
            ? { isPublished: fields.isPublished }
            : {}),
        },
        where: { id },
      })
      return toDoc(doc)
    } catch {
      throw new NotionServiceError("NOT_FOUND")
    }
  }

  async removeIcon(callerRole: CallerRole, id: string): Promise<NotionDoc> {
    assertCanWrite(callerRole)
    const doc = await prisma.document.update({
      where: { id },
      data: { icon: null },
    })
    return toDoc(doc)
  }

  async removeCoverImage(
    callerRole: CallerRole,
    id: string
  ): Promise<NotionDoc> {
    assertCanWrite(callerRole)
    const doc = await prisma.document.update({
      where: { id },
      data: { coverImage: null },
    })
    return toDoc(doc)
  }

  /** Soft-delete the doc and its whole subtree (spec: archive cascade). */
  async archive(callerRole: CallerRole, id: string): Promise<void> {
    assertCanWrite(callerRole)
    const ids = await this.subtreeIds(id)
    await prisma.document.updateMany({
      where: { id: { in: ids } },
      data: { isArchived: true },
    })
  }

  /**
   * Un-archive the doc and its subtree. If its parent is still archived the
   * doc is re-parented to root (spec: restore cascade + reparent orphans) —
   * still reachable via Cmd+K search.
   */
  async restore(callerRole: CallerRole, id: string): Promise<void> {
    assertCanWrite(callerRole)
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) throw new NotionServiceError("NOT_FOUND")
    const ids = await this.subtreeIds(id)
    await prisma.document.updateMany({
      where: { id: { in: ids } },
      data: { isArchived: false },
    })
    if (doc.parentDocumentId) {
      const parent = await prisma.document.findUnique({
        where: { id: doc.parentDocumentId },
      })
      if (!parent || parent.isArchived) {
        await prisma.document.update({
          where: { id },
          data: { parentDocumentId: null },
        })
      }
    }
  }

  /** Permanent delete, cascading over the whole subtree. */
  async remove(callerRole: CallerRole, id: string): Promise<void> {
    assertCanWrite(callerRole)
    const ids = await this.subtreeIds(id)
    await prisma.document.deleteMany({ where: { id: { in: ids } } })
  }

  async getTrash(callerRole: CallerRole): Promise<NotionDoc[]> {
    assertCanWrite(callerRole)
    const docs = await prisma.document.findMany({
      where: { isArchived: true },
      orderBy: { updatedAt: "desc" },
    })
    return docs.map(toDoc)
  }

  /** Admin-only global search corpus (cmdk filters client-side by title). */
  async getSearch(callerRole: CallerRole): Promise<NotionDoc[]> {
    assertCanWrite(callerRole)
    const docs = await prisma.document.findMany({
      where: { isArchived: false },
      orderBy: { updatedAt: "desc" },
    })
    return docs.map(toDoc)
  }

  /** Persist a dnd-kit sibling reorder: position = index in `orderedIds`. */
  async reorder(
    callerRole: CallerRole,
    parentDocumentId: string,
    orderedIds: string[]
  ): Promise<void> {
    assertCanWrite(callerRole)
    await prisma.$transaction(
      orderedIds.map((docId, index) =>
        prisma.document.update({
          where: { id: docId, parentDocumentId },
          data: { position: index },
        })
      )
    )
  }

  // ponytail: BFS with one query per depth level; swap for a recursive CTE if
  // trees ever get deep enough to matter.
  private async subtreeIds(rootId: string): Promise<string[]> {
    const ids = [rootId]
    let frontier = [rootId]
    while (frontier.length > 0) {
      const children = await prisma.document.findMany({
        where: { parentDocumentId: { in: frontier } },
        select: { id: true },
      })
      frontier = children.map((c) => c.id)
      ids.push(...frontier)
    }
    return ids
  }
}
