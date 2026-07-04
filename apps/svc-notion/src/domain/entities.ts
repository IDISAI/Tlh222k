// Domain entities — plain types, zero dependencies (Clean Architecture core).

export interface User {
  id: string
  email: string
  name: string | null
}

export interface Workspace {
  id: string
  name: string
  icon: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PageSummary {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  icon: string | null
  rank: string
  updatedAt: Date
}

export interface Page extends PageSummary {
  coverUrl: string | null
  content: unknown // BlockNote document JSON
  properties: unknown // property values when page is a database row
  visibility: "WORKSPACE" | "PRIVATE"
  isPublic: boolean
  createdById: string
  deletedAt: Date | null
  createdAt: Date
}

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multiSelect"
  | "date"
  | "person"
  | "checkbox"
  | "url"
  | "relation"
  | "rollup"
  | "formula"

export interface PropertyDef {
  id: string
  name: string
  type: PropertyType
  options?: string[]
}

export type ViewType = "TABLE" | "BOARD" | "LIST" | "CALENDAR" | "GALLERY"

export interface ViewFilter {
  propertyId: string
  op: "eq" | "neq" | "contains" | "empty" | "notEmpty" | "gt" | "lt"
  value?: unknown
}

export interface ViewSort {
  propertyId: string
  direction: "asc" | "desc"
}

export interface ViewConfig {
  filters?: ViewFilter[]
  sorts?: ViewSort[]
  groupBy?: string
  hiddenProperties?: string[]
}

export interface DatabaseDef {
  id: string
  pageId: string
  propertySchema: PropertyDef[]
}

export interface DatabaseView {
  id: string
  databaseId: string
  type: ViewType
  name: string
  config: ViewConfig
  rank: string
}

export interface Comment {
  id: string
  pageId: string
  blockId: string | null
  parentId: string | null
  authorId: string
  body: string
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Favorite {
  id: string
  userId: string
  pageId: string
  rank: string
}

export interface PageVersion {
  id: string
  pageId: string
  title: string
  content: unknown
  createdById: string
  createdAt: Date
}

// ponytail: naive append-only rank (suffix per insert) — swap in the
// `fractional-indexing` package when drag-to-reorder ships.
export const nextRank = (last: string | null): string =>
  last ? last + "V" : "a0"
