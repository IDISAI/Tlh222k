// Use-cases — orchestrate domain rules through ports. No HTTP, no Prisma.
// Every authenticated operation takes the acting userId and enforces
// workspace membership before touching data.
import { nextRank } from "../domain/entities"
import type { Page, PropertyDef, ViewConfig, ViewType } from "../domain/entities"
import { ForbiddenError } from "../domain/errors"
import type {
  CommentRepo,
  DatabaseRepo,
  FavoriteRepo,
  PageRepo,
  UpdatePageData,
  UserRepo,
  VersionRepo,
  WorkspaceRepo,
} from "../domain/ports"
import { applyView } from "./view-filter"

// ponytail: membership-or-nothing — per-role permissions when roles matter.
export class MembershipGuard {
  constructor(
    private workspaces: WorkspaceRepo,
    private pages: PageRepo
  ) {}

  async assertMember(workspaceId: string, userId: string): Promise<void> {
    if (!(await this.workspaces.isMember(workspaceId, userId))) {
      throw new ForbiddenError()
    }
  }

  /** Load a page and assert the user can touch it. Null when page missing. */
  async page(pageId: string, userId: string): Promise<Page | null> {
    const page = await this.pages.byId(pageId)
    if (!page) return null
    await this.assertMember(page.workspaceId, userId)
    return page
  }
}

export class UserUseCases {
  constructor(private users: UserRepo) {}

  me(userId: string) {
    return this.users.byId(userId)
  }
}

export class WorkspaceUseCases {
  constructor(private workspaces: WorkspaceRepo) {}

  list(userId: string) {
    return this.workspaces.listByUser(userId)
  }

  create(userId: string, name: string) {
    return this.workspaces.create(name, userId)
  }
}

export class PageUseCases {
  constructor(
    private pages: PageRepo,
    private guard: MembershipGuard
  ) {}

  async tree(userId: string, workspaceId: string) {
    await this.guard.assertMember(workspaceId, userId)
    return this.pages.tree(workspaceId)
  }

  get(userId: string, id: string) {
    return this.guard.page(id, userId)
  }

  /** Share link — anyone may read a page flagged public. */
  async getPublic(id: string) {
    const page = await this.pages.byId(id)
    return page && page.isPublic && page.deletedAt === null ? page : null
  }

  async create(
    userId: string,
    input: {
      workspaceId: string
      parentId?: string | null
      title?: string | null
      content?: unknown
      properties?: unknown
    }
  ) {
    await this.guard.assertMember(input.workspaceId, userId)
    const parentId = input.parentId ?? null
    const rank = nextRank(await this.pages.lastRank(input.workspaceId, parentId))
    return this.pages.create({
      workspaceId: input.workspaceId,
      parentId,
      title: input.title ?? "",
      rank,
      createdById: userId,
      content: input.content,
      properties: input.properties,
    })
  }

  async update(userId: string, id: string, data: UpdatePageData) {
    const page = await this.guard.page(id, userId)
    if (!page) return null
    return this.pages.update(id, data)
  }

  async trash(userId: string, id: string) {
    const page = await this.guard.page(id, userId)
    if (!page) return null
    return this.pages.trash(id)
  }

  async restore(userId: string, id: string) {
    const page = await this.guard.page(id, userId)
    if (!page) return null
    return this.pages.restore(id)
  }

  /** Hard delete — cascades to children and sub-pages. */
  async purge(userId: string, id: string) {
    const page = await this.guard.page(id, userId)
    if (!page) return false
    return this.pages.purge(id)
  }

  async duplicate(userId: string, id: string) {
    const source = await this.guard.page(id, userId)
    if (!source) return null
    return this.create(userId, {
      workspaceId: source.workspaceId,
      parentId: source.parentId,
      title: source.title === "" ? "" : `${source.title} (copy)`,
      content: source.content ?? undefined,
      properties: source.properties ?? undefined,
    })
  }

  async listTrash(userId: string, workspaceId: string) {
    await this.guard.assertMember(workspaceId, userId)
    return this.pages.listTrash(workspaceId)
  }

  // ponytail: title-only ILIKE search — Postgres FTS when it stops being enough.
  async search(userId: string, workspaceId: string, query: string) {
    await this.guard.assertMember(workspaceId, userId)
    return this.pages.searchByTitle(workspaceId, query, 20)
  }
}

export class DatabaseUseCases {
  constructor(
    private databases: DatabaseRepo,
    private pages: PageRepo,
    private pageUseCases: PageUseCases,
    private guard: MembershipGuard
  ) {}

  /** Turn a page into a database (attaches schema + a default table view). */
  async createOnPage(userId: string, pageId: string, schema: PropertyDef[]) {
    const page = await this.guard.page(pageId, userId)
    if (!page) return null
    const existing = await this.databases.byPageId(pageId)
    if (existing) return existing
    const db = await this.databases.createForPage(pageId, schema)
    await this.databases.addView(db.id, {
      type: "TABLE",
      name: "Table",
      config: {},
      rank: "a0",
    })
    return db
  }

  async get(userId: string, id: string) {
    const db = await this.databases.byId(id)
    if (!db) return null
    if (!(await this.guard.page(db.pageId, userId))) return null
    return db
  }

  async getByPage(userId: string, pageId: string) {
    if (!(await this.guard.page(pageId, userId))) return null
    return this.databases.byPageId(pageId)
  }

  views(databaseId: string) {
    return this.databases.views(databaseId)
  }

  async updateSchema(userId: string, id: string, schema: PropertyDef[]) {
    const db = await this.get(userId, id)
    if (!db) return null
    return this.databases.updateSchema(id, schema)
  }

  /** Rows = child pages of the database's page; optional view filter/sort. */
  async rows(userId: string, databaseId: string, viewId?: string | null) {
    const db = await this.get(userId, databaseId)
    if (!db) return null
    let rows = await this.pages.children(db.pageId)
    if (viewId) {
      const view = (await this.databases.views(databaseId)).find((v) => v.id === viewId)
      if (view) rows = applyView(rows, view.config)
    }
    return rows
  }

  async addRow(
    userId: string,
    databaseId: string,
    input: { title?: string | null; properties?: unknown }
  ) {
    const db = await this.get(userId, databaseId)
    if (!db) return null
    const page = await this.pages.byId(db.pageId)
    if (!page) return null
    return this.pageUseCases.create(userId, {
      workspaceId: page.workspaceId,
      parentId: db.pageId,
      title: input.title,
      properties: input.properties ?? {},
    })
  }

  async addView(
    userId: string,
    databaseId: string,
    input: { type: ViewType; name: string; config?: ViewConfig }
  ) {
    const db = await this.get(userId, databaseId)
    if (!db) return null
    const views = await this.databases.views(databaseId)
    const rank = nextRank(views.at(-1)?.rank ?? null)
    return this.databases.addView(databaseId, {
      type: input.type,
      name: input.name,
      config: input.config ?? {},
      rank,
    })
  }

  /** view → database → page membership walk before any view mutation. */
  private async assertViewAccess(userId: string, viewId: string) {
    const view = await this.databases.viewById(viewId)
    if (!view) return false
    return (await this.get(userId, view.databaseId)) !== null
  }

  async updateView(
    userId: string,
    id: string,
    patch: Partial<{ type: ViewType; name: string; config: ViewConfig }>
  ) {
    if (!(await this.assertViewAccess(userId, id))) return null
    return this.databases.updateView(id, patch)
  }

  async deleteView(userId: string, id: string) {
    if (!(await this.assertViewAccess(userId, id))) return false
    return this.databases.deleteView(id)
  }
}

export class CommentUseCases {
  constructor(
    private comments: CommentRepo,
    private guard: MembershipGuard
  ) {}

  async listByPage(userId: string, pageId: string) {
    if (!(await this.guard.page(pageId, userId))) return []
    return this.comments.listByPage(pageId)
  }

  async create(
    userId: string,
    input: {
      pageId: string
      blockId?: string | null
      parentId?: string | null
      body: string
    }
  ) {
    const page = await this.guard.page(input.pageId, userId)
    if (!page) return null
    return this.comments.create({
      pageId: input.pageId,
      blockId: input.blockId ?? null,
      parentId: input.parentId ?? null,
      authorId: userId,
      body: input.body,
    })
  }

  async update(
    userId: string,
    id: string,
    patch: { body?: string; resolved?: boolean }
  ) {
    const comment = await this.comments.byId(id)
    if (!comment) return null
    if (!(await this.guard.page(comment.pageId, userId))) return null
    return this.comments.update(id, {
      body: patch.body,
      resolvedAt:
        patch.resolved === undefined ? undefined : patch.resolved ? new Date() : null,
    })
  }

  async delete(userId: string, id: string) {
    const comment = await this.comments.byId(id)
    if (!comment) return false
    if (!(await this.guard.page(comment.pageId, userId))) return false
    return this.comments.delete(id)
  }
}

export class FavoriteUseCases {
  constructor(
    private favorites: FavoriteRepo,
    private guard: MembershipGuard
  ) {}

  list(userId: string) {
    return this.favorites.listByUser(userId)
  }

  async add(userId: string, pageId: string) {
    const page = await this.guard.page(pageId, userId)
    if (!page) return null
    const existing = await this.favorites.find(userId, pageId)
    if (existing) return existing
    const rank = nextRank(await this.favorites.lastRank(userId))
    return this.favorites.add(userId, pageId, rank)
  }

  remove(userId: string, pageId: string) {
    return this.favorites.remove(userId, pageId)
  }
}

export class VersionUseCases {
  constructor(
    private versions: VersionRepo,
    private pages: PageRepo,
    private guard: MembershipGuard
  ) {}

  async listByPage(userId: string, pageId: string) {
    if (!(await this.guard.page(pageId, userId))) return []
    return this.versions.listByPage(pageId)
  }

  /** Snapshot the page's current title+content. */
  async snapshot(userId: string, pageId: string) {
    const page = await this.guard.page(pageId, userId)
    if (!page) return null
    return this.versions.create({
      pageId,
      title: page.title,
      content: page.content,
      createdById: userId,
    })
  }

  /** Restore a version (snapshots current state first, so restore is undoable). */
  async restore(userId: string, versionId: string) {
    const version = await this.versions.byId(versionId)
    if (!version) return null
    const page = await this.guard.page(version.pageId, userId)
    if (!page) return null
    await this.snapshot(userId, version.pageId)
    return this.pages.update(version.pageId, {
      title: version.title,
      content: version.content,
    })
  }
}
