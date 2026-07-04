// ponytail: contract-only — real data flows through GraphQL (/graphql).
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { MOCK_COMMENT, MOCK_FAVORITE, MOCK_PAGE, MOCK_VERSION } from "./mocks"
import {
  CommentSchema,
  ErrorSchema,
  FavoriteSchema,
  IdParam,
  jsonBody,
  jsonContent,
  PageSchema,
  toDto,
  VersionSchema,
} from "./schemas"

export const collabRouter = new OpenAPIHono()

// ── comments ─────────────────────────────────────────────────────────────────

collabRouter.openapi(
  createRoute({
    method: "get",
    path: "/pages/{id}/comments",
    tags: ["comments"],
    summary: "List comments of a page (mock)",
    request: { params: IdParam },
    responses: { 200: jsonContent(z.array(CommentSchema), "OK") },
  }),
  (c) => c.json(toDto([MOCK_COMMENT]), 200)
)

collabRouter.openapi(
  createRoute({
    method: "post",
    path: "/pages/{id}/comments",
    tags: ["comments"],
    summary: "Add comment (mock)",
    request: {
      params: IdParam,
      ...jsonBody(
        z.object({
          body: z.string().min(1).max(10000),
          blockId: z.string().nullish(),
          parentId: z.string().nullish(),
        })
      ),
    },
    responses: { 201: jsonContent(CommentSchema, "Created") },
  }),
  (c) => c.json(toDto({ ...MOCK_COMMENT, body: c.req.valid("json").body }), 201)
)

collabRouter.openapi(
  createRoute({
    method: "patch",
    path: "/comments/{id}",
    tags: ["comments"],
    summary: "Edit / resolve comment (mock)",
    request: {
      params: IdParam,
      ...jsonBody(
        z.object({
          body: z.string().min(1).max(10000).optional(),
          resolved: z.boolean().optional(),
        })
      ),
    },
    responses: {
      200: jsonContent(CommentSchema, "Updated"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto(MOCK_COMMENT), 200)
)

collabRouter.openapi(
  createRoute({
    method: "delete",
    path: "/comments/{id}",
    tags: ["comments"],
    summary: "Delete comment (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(z.object({ deleted: z.boolean() }), "Deleted"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json({ deleted: true }, 200)
)

// ── favorites ────────────────────────────────────────────────────────────────

collabRouter.openapi(
  createRoute({
    method: "get",
    path: "/favorites",
    tags: ["favorites"],
    summary: "List favorites (mock)",
    responses: { 200: jsonContent(z.array(FavoriteSchema), "OK") },
  }),
  (c) => c.json(toDto([MOCK_FAVORITE]), 200)
)

collabRouter.openapi(
  createRoute({
    method: "put",
    path: "/favorites/{id}",
    tags: ["favorites"],
    summary: "Add favorite (mock; id = pageId)",
    request: { params: IdParam },
    responses: { 200: jsonContent(FavoriteSchema, "OK") },
  }),
  (c) => c.json(toDto(MOCK_FAVORITE), 200)
)

collabRouter.openapi(
  createRoute({
    method: "delete",
    path: "/favorites/{id}",
    tags: ["favorites"],
    summary: "Remove favorite (mock; id = pageId)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(z.object({ deleted: z.boolean() }), "Deleted"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json({ deleted: true }, 200)
)

// ── versions ─────────────────────────────────────────────────────────────────

collabRouter.openapi(
  createRoute({
    method: "get",
    path: "/pages/{id}/versions",
    tags: ["versions"],
    summary: "Version history (mock)",
    request: { params: IdParam },
    responses: { 200: jsonContent(z.array(VersionSchema), "OK") },
  }),
  (c) => c.json(toDto([MOCK_VERSION]), 200)
)

collabRouter.openapi(
  createRoute({
    method: "post",
    path: "/pages/{id}/versions",
    tags: ["versions"],
    summary: "Snapshot page (mock)",
    request: { params: IdParam },
    responses: {
      201: jsonContent(VersionSchema, "Created"),
      404: jsonContent(ErrorSchema, "Page not found"),
    },
  }),
  (c) => c.json(toDto(MOCK_VERSION), 201)
)

collabRouter.openapi(
  createRoute({
    method: "post",
    path: "/versions/{id}/restore",
    tags: ["versions"],
    summary: "Restore version (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(PageSchema, "Restored"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto(MOCK_PAGE), 200)
)
