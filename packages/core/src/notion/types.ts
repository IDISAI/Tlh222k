import type { UserRole } from "../navigation/types"

/**
 * Caller's role for service-level permission checks — same union as
 * `UserRole` from navigation (single role system, Req: reuse Clerk roles).
 */
export type CallerRole = UserRole

/**
 * Client-safe Document shape (dates serialized to ISO strings so it crosses
 * the Server Action boundary untouched). Mirrors the Prisma `Document` model.
 */
export interface NotionDoc {
  id: string
  /** Set only on ROOT docs backing a roadmap "notion" article node. */
  slug: string | null
  title: string
  authorId: string
  isArchived: boolean
  parentDocumentId: string | null
  /** BlockNote block array as JSON string. */
  content: string | null
  coverImage: string | null
  icon: string | null
  isPublished: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentInput {
  title?: string
  parentDocumentId?: string | null
  /** Only for the root doc auto-created for an article slug (admin page). */
  slug?: string
}

export interface UpdateDocumentInput {
  id: string
  title?: string
  content?: string
  icon?: string
  coverImage?: string
  isPublished?: boolean
}

// ── Server-action bundles injected into <NotionWorkspace/> ──────────────────
// canEdit is a UI hint ONLY — every action re-resolves the caller's role on
// the server and the service re-checks it (assertCanWrite).

/** Reads available in BOTH zones (web passes only these). */
export interface NotionReadActions {
  getById(id: string): Promise<NotionDoc | null>
  getChildren(parentDocumentId: string): Promise<NotionDoc[]>
}

/** Writes + admin-only reads (admin zone only). */
export interface NotionWriteActions {
  create(input: CreateDocumentInput): Promise<NotionDoc>
  update(input: UpdateDocumentInput): Promise<NotionDoc>
  archive(id: string): Promise<void>
  restore(id: string): Promise<void>
  remove(id: string): Promise<void>
  getTrash(): Promise<NotionDoc[]>
  getSearch(): Promise<NotionDoc[]>
  reorder(parentDocumentId: string, orderedIds: string[]): Promise<void>
  removeIcon(id: string): Promise<NotionDoc>
  removeCoverImage(id: string): Promise<NotionDoc>
  /** FormData with a "file" entry → public URL (@vercel/blob in the app). */
  uploadFile(form: FormData): Promise<{ url: string }>
}

export type NotionActions = NotionReadActions & Partial<NotionWriteActions>

// ── Service errors (mirrors RoadmapServiceError) ─────────────────────────────

export type NotionErrorCode = "PERMISSION_DENIED" | "NOT_FOUND"

export class NotionServiceError extends Error {
  readonly code: NotionErrorCode

  constructor(code: NotionErrorCode, message?: string) {
    super(message ?? code)
    this.name = "NotionServiceError"
    this.code = code
  }
}
