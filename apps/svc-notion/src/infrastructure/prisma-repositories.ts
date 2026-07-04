// Infrastructure — Prisma implementations of the domain ports.
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db"

import type {
  Comment,
  DatabaseDef,
  DatabaseView,
  Favorite,
  Page,
  PageSummary,
  PageVersion,
  PropertyDef,
  User,
  ViewConfig,
  ViewType,
  Workspace,
} from "../domain/entities"
import type {
  CommentRepo,
  CreatePageData,
  DatabaseRepo,
  FavoriteRepo,
  PageRepo,
  UpdatePageData,
  UserRepo,
  VersionRepo,
  WorkspaceRepo,
} from "../domain/ports"

const json = (v: unknown) => v as Prisma.InputJsonValue

/** Prisma "record not found" (P2025) → null/false, so callers can 404. */
async function orNull<T>(op: Promise<T>): Promise<T | null> {
  try {
    return await op
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2025"
    ) {
      return null
    }
    throw e
  }
}

const pageSummarySelect = {
  id: true,
  workspaceId: true,
  parentId: true,
  title: true,
  icon: true,
  rank: true,
  updatedAt: true,
} as const

export class PrismaUserRepo implements UserRepo {
  byId(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    })
  }
}

export class PrismaWorkspaceRepo implements WorkspaceRepo {
  listByUser(userId: string): Promise<Workspace[]> {
    return prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    })
  }

  create(name: string, ownerId: string): Promise<Workspace> {
    return prisma.workspace.create({
      data: { name, members: { create: { userId: ownerId, role: "OWNER" } } },
    })
  }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    })
    return member !== null
  }
}

export class PrismaPageRepo implements PageRepo {
  tree(workspaceId: string): Promise<PageSummary[]> {
    return prisma.page.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { rank: "asc" },
      select: pageSummarySelect,
    })
  }

  byId(id: string): Promise<Page | null> {
    return prisma.page.findUnique({ where: { id } })
  }

  create(data: CreatePageData): Promise<Page> {
    return prisma.page.create({
      data: {
        workspaceId: data.workspaceId,
        parentId: data.parentId,
        title: data.title,
        rank: data.rank,
        createdById: data.createdById,
        ...(data.content !== undefined && { content: json(data.content) }),
        ...(data.properties !== undefined && { properties: json(data.properties) }),
      },
    })
  }

  update(id: string, data: UpdatePageData): Promise<Page | null> {
    return orNull(
      prisma.page.update({
        where: { id },
        data: {
          title: data.title,
          icon: data.icon,
          coverUrl: data.coverUrl,
          parentId: data.parentId,
          visibility: data.visibility,
          isPublic: data.isPublic,
          ...(data.content !== undefined && { content: json(data.content) }),
          ...(data.properties !== undefined && {
            properties: json(data.properties),
          }),
        },
      })
    )
  }

  trash(id: string): Promise<Page | null> {
    return orNull(
      prisma.page.update({ where: { id }, data: { deletedAt: new Date() } })
    )
  }

  restore(id: string): Promise<Page | null> {
    return orNull(
      prisma.page.update({ where: { id }, data: { deletedAt: null } })
    )
  }

  async purge(id: string): Promise<boolean> {
    return (await orNull(prisma.page.delete({ where: { id } }))) !== null
  }

  listTrash(workspaceId: string): Promise<PageSummary[]> {
    return prisma.page.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: pageSummarySelect,
    })
  }

  async lastRank(
    workspaceId: string,
    parentId: string | null
  ): Promise<string | null> {
    const last = await prisma.page.findFirst({
      where: { workspaceId, parentId, deletedAt: null },
      orderBy: { rank: "desc" },
      select: { rank: true },
    })
    return last?.rank ?? null
  }

  children(pageId: string): Promise<Page[]> {
    return prisma.page.findMany({
      where: { parentId: pageId, deletedAt: null },
      orderBy: { rank: "asc" },
    })
  }

  searchByTitle(
    workspaceId: string,
    query: string,
    limit: number
  ): Promise<PageSummary[]> {
    return prisma.page.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        title: { contains: query, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: pageSummarySelect,
    })
  }
}

const toDatabaseDef = (db: {
  id: string
  pageId: string
  propertySchema: unknown
}): DatabaseDef => ({
  id: db.id,
  pageId: db.pageId,
  propertySchema: db.propertySchema as PropertyDef[],
})

const toView = (v: {
  id: string
  databaseId: string
  type: ViewType
  name: string
  config: unknown
  rank: string
}): DatabaseView => ({
  id: v.id,
  databaseId: v.databaseId,
  type: v.type,
  name: v.name,
  config: (v.config ?? {}) as ViewConfig,
  rank: v.rank,
})

export class PrismaDatabaseRepo implements DatabaseRepo {
  async createForPage(
    pageId: string,
    schema: PropertyDef[]
  ): Promise<DatabaseDef> {
    return toDatabaseDef(
      await prisma.database.create({
        data: { pageId, propertySchema: json(schema) },
      })
    )
  }

  async byId(id: string): Promise<DatabaseDef | null> {
    const db = await prisma.database.findUnique({ where: { id } })
    return db && toDatabaseDef(db)
  }

  async byPageId(pageId: string): Promise<DatabaseDef | null> {
    const db = await prisma.database.findUnique({ where: { pageId } })
    return db && toDatabaseDef(db)
  }

  async updateSchema(
    id: string,
    schema: PropertyDef[]
  ): Promise<DatabaseDef | null> {
    const db = await orNull(
      prisma.database.update({
        where: { id },
        data: { propertySchema: json(schema) },
      })
    )
    return db && toDatabaseDef(db)
  }

  async views(databaseId: string): Promise<DatabaseView[]> {
    const views = await prisma.databaseView.findMany({
      where: { databaseId },
      orderBy: { rank: "asc" },
    })
    return views.map(toView)
  }

  async viewById(id: string): Promise<DatabaseView | null> {
    const view = await prisma.databaseView.findUnique({ where: { id } })
    return view && toView(view)
  }

  async addView(
    databaseId: string,
    view: { type: ViewType; name: string; config: ViewConfig; rank: string }
  ): Promise<DatabaseView> {
    return toView(
      await prisma.databaseView.create({
        data: { databaseId, ...view, config: json(view.config) },
      })
    )
  }

  async updateView(
    id: string,
    patch: Partial<{ type: ViewType; name: string; config: ViewConfig }>
  ): Promise<DatabaseView | null> {
    const view = await orNull(
      prisma.databaseView.update({
        where: { id },
        data: {
          type: patch.type,
          name: patch.name,
          ...(patch.config !== undefined && { config: json(patch.config) }),
        },
      })
    )
    return view && toView(view)
  }

  async deleteView(id: string): Promise<boolean> {
    return (await orNull(prisma.databaseView.delete({ where: { id } }))) !== null
  }
}

export class PrismaCommentRepo implements CommentRepo {
  listByPage(pageId: string): Promise<Comment[]> {
    return prisma.comment.findMany({
      where: { pageId },
      orderBy: { createdAt: "asc" },
    })
  }

  byId(id: string): Promise<Comment | null> {
    return prisma.comment.findUnique({ where: { id } })
  }

  create(data: {
    pageId: string
    blockId: string | null
    parentId: string | null
    authorId: string
    body: string
  }): Promise<Comment> {
    return prisma.comment.create({ data })
  }

  update(
    id: string,
    patch: { body?: string; resolvedAt?: Date | null }
  ): Promise<Comment | null> {
    return orNull(prisma.comment.update({ where: { id }, data: patch }))
  }

  async delete(id: string): Promise<boolean> {
    return (await orNull(prisma.comment.delete({ where: { id } }))) !== null
  }
}

export class PrismaFavoriteRepo implements FavoriteRepo {
  listByUser(userId: string): Promise<Favorite[]> {
    return prisma.favorite.findMany({
      where: { userId },
      orderBy: { rank: "asc" },
    })
  }

  find(userId: string, pageId: string): Promise<Favorite | null> {
    return prisma.favorite.findUnique({
      where: { userId_pageId: { userId, pageId } },
    })
  }

  add(userId: string, pageId: string, rank: string): Promise<Favorite> {
    return prisma.favorite.create({ data: { userId, pageId, rank } })
  }

  async remove(userId: string, pageId: string): Promise<boolean> {
    return (
      (await orNull(
        prisma.favorite.delete({
          where: { userId_pageId: { userId, pageId } },
        })
      )) !== null
    )
  }

  async lastRank(userId: string): Promise<string | null> {
    const last = await prisma.favorite.findFirst({
      where: { userId },
      orderBy: { rank: "desc" },
      select: { rank: true },
    })
    return last?.rank ?? null
  }
}

export class PrismaVersionRepo implements VersionRepo {
  listByPage(pageId: string): Promise<PageVersion[]> {
    return prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
    })
  }

  byId(id: string): Promise<PageVersion | null> {
    return prisma.pageVersion.findUnique({ where: { id } })
  }

  create(data: {
    pageId: string
    title: string
    content: unknown
    createdById: string
  }): Promise<PageVersion> {
    return prisma.pageVersion.create({
      data: {
        pageId: data.pageId,
        title: data.title,
        createdById: data.createdById,
        ...(data.content !== undefined &&
          data.content !== null && { content: json(data.content) }),
      },
    })
  }
}
