/**
 * Role resolved from the Clerk JWT `publicMetadata.role` claim.
 * Absent / unrecognized metadata is treated as `"viewer"` (Req 5.5).
 * Monotonicity (A1): super-admin ⊇ admin ⊇ viewer.
 */
export type UserRole = "viewer" | "admin" | "super-admin"
