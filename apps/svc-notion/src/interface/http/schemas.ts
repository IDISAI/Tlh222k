import { z } from "@hono/zod-openapi"

// Zod schemas — single source for request validation AND the generated
// OpenAPI spec (served at /openapi.json, rendered at /docs).

export const ErrorSchema = z.object({ error: z.string() }).openapi("Error")

export const WorkspaceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Workspace")

export const PageSummarySchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    parentId: z.string().nullable(),
    title: z.string(),
    icon: z.string().nullable(),
    rank: z.string(),
    updatedAt: z.string(),
  })
  .openapi("PageSummary")

export const PageSchema = PageSummarySchema.extend({
  coverUrl: z.string().nullable(),
  content: z.unknown().nullable().openapi({ description: "BlockNote document JSON" }),
  properties: z.unknown().nullable().openapi({ description: "Database row property values" }),
  visibility: z.enum(["WORKSPACE", "PRIVATE"]),
  isPublic: z.boolean(),
  createdById: z.string(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
}).openapi("Page")

export const PropertyDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum([
      "text",
      "number",
      "select",
      "multiSelect",
      "date",
      "person",
      "checkbox",
      "url",
      "relation",
      "rollup",
      "formula",
    ]),
    options: z.array(z.string()).optional(),
  })
  .openapi("PropertyDef")

export const ViewConfigSchema = z
  .object({
    filters: z
      .array(
        z.object({
          propertyId: z.string(),
          op: z.enum(["eq", "neq", "contains", "empty", "notEmpty", "gt", "lt"]),
          value: z.unknown().optional(),
        })
      )
      .optional(),
    sorts: z
      .array(
        z.object({
          propertyId: z.string(),
          direction: z.enum(["asc", "desc"]),
        })
      )
      .optional(),
    groupBy: z.string().optional(),
    hiddenProperties: z.array(z.string()).optional(),
  })
  .openapi("ViewConfig")

export const ViewTypeSchema = z.enum([
  "TABLE",
  "BOARD",
  "LIST",
  "CALENDAR",
  "GALLERY",
])

export const ViewSchema = z
  .object({
    id: z.string(),
    databaseId: z.string(),
    type: ViewTypeSchema,
    name: z.string(),
    config: ViewConfigSchema,
    rank: z.string(),
  })
  .openapi("DatabaseView")

export const DatabaseSchema = z
  .object({
    id: z.string(),
    pageId: z.string(),
    propertySchema: z.array(PropertyDefSchema),
  })
  .openapi("Database")

export const DatabaseWithViewsSchema = DatabaseSchema.extend({
  views: z.array(ViewSchema),
}).openapi("DatabaseWithViews")

export const CommentSchema = z
  .object({
    id: z.string(),
    pageId: z.string(),
    blockId: z.string().nullable(),
    parentId: z.string().nullable(),
    authorId: z.string(),
    body: z.string(),
    resolvedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Comment")

export const FavoriteSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    pageId: z.string(),
    rank: z.string(),
  })
  .openapi("Favorite")

export const VersionSchema = z
  .object({
    id: z.string(),
    pageId: z.string(),
    title: z.string(),
    content: z.unknown().nullable(),
    createdById: z.string(),
    createdAt: z.string(),
  })
  .openapi("PageVersion")

// ── helpers ──────────────────────────────────────────────────────────────────

export const IdParam = z.object({
  id: z.string().min(1).openapi({ param: { name: "id", in: "path" } }),
})

export const jsonContent = <T extends z.ZodTypeAny>(
  schema: T,
  description: string
) => ({ content: { "application/json": { schema } }, description })

export const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
})

export const notFound = { error: "Not found" }

// ponytail: Date → ISO string via JSON round-trip. Response schemas document
// the contract; the runtime gate is request validation above.
export const toDto = (v: unknown) => JSON.parse(JSON.stringify(v)) as never
