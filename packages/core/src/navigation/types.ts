/**
 * Role resolved from the Clerk JWT `publicMetadata.role` claim.
 * Absent / unrecognized metadata is treated as `"viewer"` (Req 5.5).
 * `aio` is a learner audience for Internal content; it is not a CMS writer.
 */
export type UserRole = "viewer" | "aio" | "admin" | "super-admin"
