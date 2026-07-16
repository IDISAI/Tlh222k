import { Injectable } from "@nestjs/common"
import type { Document, Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service"
import { RoadmapError } from "../common/roadmap-error"
import { assertCanWrite, isAdmin, type CurrentUser } from "../auth/clerk"

export interface NotionDoc {
  id: string
  slug: string | null
  title: string
  authorId: string
  isArchived: boolean
  parentDocumentId: string | null
  content: string | null
  coverImage: string | null
  icon: string | null
  isPublished: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentInput {
  title?: string | null
  parentDocumentId?: string | null
  slug?: string | null
}

export interface UpdateDocumentInput {
  id: string
  title?: string | null
  content?: string | null
  icon?: string | null
  coverImage?: string | null
  isPublished?: boolean | null
}

// Defensive cap so an ever-growing corpus can't return an unbounded payload.
// The sidebar/cmdk never needs more; real cursor pagination lands with the UI.
const LIST_LIMIT = 500
const TREE_TRANSACTION_OPTIONS = {
  timeout: 10_000,
  isolationLevel: "Serializable" as const,
}

type NotionQueryClient = Pick<Prisma.TransactionClient, "$queryRaw">

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
 * Notion-workspace domain service. Ported from packages/core/src/notion into
 * the API so roadmap↔document writes share one Prisma process (transactional
 * cross-link). Trust boundary is here (server), not the UI's `canEdit` flag.
 */
@Injectable()
export class NotionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Root doc for a roadmap article slug. Viewers: published only. */
  async getBySlug(
    user: CurrentUser | null,
    slug: string
  ): Promise<NotionDoc | null> {
    const doc = await this.prisma.document.findUnique({ where: { slug } })
    if (!doc || doc.isArchived) return null
    if (!isAdmin(user) && !doc.isPublished) return null
    return toDoc(doc)
  }

  /** Published-or-admin gate. */
  async getById(
    user: CurrentUser | null,
    id: string
  ): Promise<NotionDoc | null> {
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) return null
    if (!isAdmin(user) && !(doc.isPublished && !doc.isArchived)) return null
    return toDoc(doc)
  }

  async getChildren(
    user: CurrentUser | null,
    parentDocumentId: string
  ): Promise<NotionDoc[]> {
    const docs = await this.prisma.document.findMany({
      where: {
        parentDocumentId,
        isArchived: false,
        ...(isAdmin(user) ? {} : { isPublished: true }),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })
    return docs.map(toDoc)
  }

  async create(
    user: CurrentUser | null,
    authorId: string,
    input: CreateDocumentInput
  ): Promise<NotionDoc> {
    assertCanWrite(user)
    const parentDocumentId = input.parentDocumentId ?? null
    const position = await this.prisma.document.count({
      where: { parentDocumentId },
    })
    const doc = await this.prisma.document.create({
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
    user: CurrentUser | null,
    input: UpdateDocumentInput
  ): Promise<NotionDoc> {
    assertCanWrite(user)
    const { id, ...fields } = input
    try {
      const doc = await this.prisma.document.update({
        where: { id },
        data: {
          ...(fields.title != null ? { title: fields.title } : {}),
          ...(fields.content !== undefined ? { content: fields.content } : {}),
          ...(fields.icon !== undefined ? { icon: fields.icon } : {}),
          ...(fields.coverImage !== undefined
            ? { coverImage: fields.coverImage }
            : {}),
          ...(fields.isPublished != null
            ? { isPublished: fields.isPublished }
            : {}),
        },
      })
      return toDoc(doc)
    } catch {
      throw new RoadmapError("NOT_FOUND")
    }
  }

  async removeIcon(user: CurrentUser | null, id: string): Promise<NotionDoc> {
    assertCanWrite(user)
    const doc = await this.prisma.document.update({
      where: { id },
      data: { icon: null },
    })
    return toDoc(doc)
  }

  async removeCoverImage(
    user: CurrentUser | null,
    id: string
  ): Promise<NotionDoc> {
    assertCanWrite(user)
    const doc = await this.prisma.document.update({
      where: { id },
      data: { coverImage: null },
    })
    return toDoc(doc)
  }

  /**
   * Re-parent a document (drag-to-nest). `newParentId = null` moves to the top
   * level. Rejects a move into the doc's own subtree so the tree can't cycle.
   */
  async move(
    user: CurrentUser | null,
    id: string,
    newParentId: string | null
  ): Promise<NotionDoc> {
    assertCanWrite(user)
    if (id === newParentId) throw new RoadmapError("NOT_FOUND")
    const moved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext('notion-document-tree'))
      `

      const doc = await tx.document.findUnique({ where: { id } })
      if (!doc) throw new RoadmapError("NOT_FOUND")

      if (newParentId) {
        const subtree = new Set(await this.subtreeIds(id, tx))
        if (subtree.has(newParentId)) throw new RoadmapError("NOT_FOUND")
        const parent = await tx.document.findUnique({
          where: { id: newParentId },
        })
        if (!parent || parent.isArchived) throw new RoadmapError("NOT_FOUND")
      }

      const position = await tx.document.count({
        where: { parentDocumentId: newParentId },
      })
      return tx.document.update({
        where: { id },
        data: { parentDocumentId: newParentId, position },
      })
    }, TREE_TRANSACTION_OPTIONS)
    return toDoc(moved)
  }

  /** Soft-delete the doc and its whole subtree. */
  async archive(user: CurrentUser | null, id: string): Promise<void> {
    assertCanWrite(user)
    const ids = await this.subtreeIds(id)
    await this.prisma.document.updateMany({
      where: { id: { in: ids } },
      data: { isArchived: true },
    })
  }

  /**
   * Un-archive the doc and its subtree. If its parent is still archived the doc
   * is re-parented to root so it stays reachable.
   */
  async restore(user: CurrentUser | null, id: string): Promise<void> {
    assertCanWrite(user)
    const doc = await this.prisma.document.findUnique({ where: { id } })
    if (!doc) throw new RoadmapError("NOT_FOUND")
    const ids = await this.subtreeIds(id)
    await this.prisma.document.updateMany({
      where: { id: { in: ids } },
      data: { isArchived: false },
    })
    if (doc.parentDocumentId) {
      const parent = await this.prisma.document.findUnique({
        where: { id: doc.parentDocumentId },
      })
      if (!parent || parent.isArchived) {
        await this.prisma.document.update({
          where: { id },
          data: { parentDocumentId: null },
        })
      }
    }
  }

  /** Permanent delete, cascading over the whole subtree. */
  async remove(user: CurrentUser | null, id: string): Promise<void> {
    assertCanWrite(user)
    const ids = await this.subtreeIds(id)
    await this.prisma.document.deleteMany({ where: { id: { in: ids } } })
  }

  async getTrash(user: CurrentUser | null): Promise<NotionDoc[]> {
    assertCanWrite(user)
    const docs = await this.prisma.document.findMany({
      where: { isArchived: true },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    })
    return docs.map(toDoc)
  }

  /** Admin-only global search corpus (cmdk filters client-side by title). */
  async getSearch(user: CurrentUser | null): Promise<NotionDoc[]> {
    assertCanWrite(user)
    const docs = await this.prisma.document.findMany({
      where: { isArchived: false },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    })
    return docs.map(toDoc)
  }

  /** Persist a dnd-kit sibling reorder: position = index in `orderedIds`. */
  async reorder(
    user: CurrentUser | null,
    parentDocumentId: string,
    orderedIds: string[]
  ): Promise<void> {
    assertCanWrite(user)
    await this.prisma.$transaction(
      orderedIds.map((docId, index) =>
        this.prisma.document.update({
          where: { id: docId, parentDocumentId },
          data: { position: index },
        })
      )
    )
  }

  // Single recursive CTE walks the whole subtree in one round-trip (Postgres),
  // replacing the old one-query-per-depth BFS.
  private async subtreeIds(
    rootId: string,
    client: NotionQueryClient = this.prisma
  ): Promise<string[]> {
    const rows = await client.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE sub AS (
        SELECT id FROM "Document" WHERE id = ${rootId}
        UNION
        SELECT d.id FROM "Document" d JOIN sub ON d."parentDocumentId" = sub.id
      )
      SELECT id FROM sub
    `
    return rows.map((r) => r.id)
  }
}
