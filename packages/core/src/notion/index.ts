// Client-safe barrel. notion.service.ts is intentionally NOT exported here —
// it imports Prisma; Server Actions import it directly via
// `@workspace/core/notion/notion.service`.
// CallerRole is deliberately not re-exported (it's `UserRole` re-badged and
// ./roadmap already exports its own CallerRole).
export {
  NotionConnectionError,
  NotionServiceError,
  type CreateDocumentInput,
  type NotionActions,
  type NotionDoc,
  type NotionErrorCode,
  type NotionReadActions,
  type NotionWriteActions,
  type UpdateDocumentInput,
} from "./types"
export * from "./components"
export * from "./hooks"
