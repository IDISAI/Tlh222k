// Repository ports — the application layer depends on these interfaces,
// never on Prisma. Infrastructure implements them.
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
} from "./entities"

export interface UserRepo {
  byId(id: string): Promise<User | null>
}

export interface WorkspaceRepo {
  listByUser(userId: string): Promise<Workspace[]>
  create(name: string, ownerId: string): Promise<Workspace>
  isMember(workspaceId: string, userId: string): Promise<boolean>
}

export interface CreatePageData {
  workspaceId: string
  parentId: string | null
  title: string
  rank: string
  createdById: string
  content?: unknown
  properties?: unknown
}

export interface UpdatePageData {
  title?: string
  icon?: string | null
  coverUrl?: string | null
  content?: unknown
  properties?: unknown
  parentId?: string | null
  visibility?: "WORKSPACE" | "PRIVATE"
  isPublic?: boolean
}

export interface PageRepo {
  tree(workspaceId: string): Promise<PageSummary[]>
  byId(id: string): Promise<Page | null>
  create(data: CreatePageData): Promise<Page>
  update(id: string, data: UpdatePageData): Promise<Page | null>
  trash(id: string): Promise<Page | null>
  restore(id: string): Promise<Page | null>
  purge(id: string): Promise<boolean>
  listTrash(workspaceId: string): Promise<PageSummary[]>
  lastRank(workspaceId: string, parentId: string | null): Promise<string | null>
  children(pageId: string): Promise<Page[]>
  searchByTitle(
    workspaceId: string,
    query: string,
    limit: number
  ): Promise<PageSummary[]>
}

export interface DatabaseRepo {
  createForPage(pageId: string, schema: PropertyDef[]): Promise<DatabaseDef>
  byId(id: string): Promise<DatabaseDef | null>
  byPageId(pageId: string): Promise<DatabaseDef | null>
  updateSchema(id: string, schema: PropertyDef[]): Promise<DatabaseDef | null>
  views(databaseId: string): Promise<DatabaseView[]>
  viewById(id: string): Promise<DatabaseView | null>
  addView(
    databaseId: string,
    view: { type: ViewType; name: string; config: ViewConfig; rank: string }
  ): Promise<DatabaseView>
  updateView(
    id: string,
    patch: Partial<{ type: ViewType; name: string; config: ViewConfig }>
  ): Promise<DatabaseView | null>
  deleteView(id: string): Promise<boolean>
}

export interface CommentRepo {
  listByPage(pageId: string): Promise<Comment[]>
  byId(id: string): Promise<Comment | null>
  create(data: {
    pageId: string
    blockId: string | null
    parentId: string | null
    authorId: string
    body: string
  }): Promise<Comment>
  update(
    id: string,
    patch: { body?: string; resolvedAt?: Date | null }
  ): Promise<Comment | null>
  delete(id: string): Promise<boolean>
}

export interface FavoriteRepo {
  listByUser(userId: string): Promise<Favorite[]>
  find(userId: string, pageId: string): Promise<Favorite | null>
  add(userId: string, pageId: string, rank: string): Promise<Favorite>
  remove(userId: string, pageId: string): Promise<boolean>
  lastRank(userId: string): Promise<string | null>
}

export interface VersionRepo {
  listByPage(pageId: string): Promise<PageVersion[]>
  byId(id: string): Promise<PageVersion | null>
  create(data: {
    pageId: string
    title: string
    content: unknown
    createdById: string
  }): Promise<PageVersion>
}
