// ponytail: contract-only — real data flows through GraphQL (/graphql).
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { MOCK_PAGE } from "./mocks"
import {
  ErrorSchema,
  IdParam,
  jsonBody,
  jsonContent,
  PageSchema,
  toDto,
} from "./schemas"

export const pagesRouter = new OpenAPIHono()

const createPageBody = z.object({
  workspaceId: z.string().min(1),
  parentId: z.string().min(1).nullish(),
  title: z.string().max(500).nullish(),
  properties: z.unknown().optional(),
})

pagesRouter.openapi(
  createRoute({
    method: "post",
    path: "/pages",
    tags: ["pages"],
    summary: "Create page (mock)",
    request: jsonBody(createPageBody),
    responses: { 201: jsonContent(PageSchema, "Created") },
  }),
  (c) => {
    const body = c.req.valid("json")
    return c.json(toDto({ ...MOCK_PAGE, title: body.title ?? "" }), 201)
  }
)

pagesRouter.openapi(
  createRoute({
    method: "get",
    path: "/pages/{id}",
    tags: ["pages"],
    summary: "Get page with content (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(PageSchema, "OK"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto(MOCK_PAGE), 200)
)

const updatePageBody = z.object({
  title: z.string().max(500).optional(),
  icon: z.string().max(64).nullable().optional(),
  coverUrl: z.string().max(2048).nullable().optional(),
  content: z.unknown().optional(),
  properties: z.unknown().optional(),
  parentId: z.string().min(1).nullable().optional(),
  visibility: z.enum(["WORKSPACE", "PRIVATE"]).optional(),
  isPublic: z.boolean().optional(),
})

pagesRouter.openapi(
  createRoute({
    method: "patch",
    path: "/pages/{id}",
    tags: ["pages"],
    summary: "Update page (mock)",
    request: { params: IdParam, ...jsonBody(updatePageBody) },
    responses: {
      200: jsonContent(PageSchema, "Updated"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto({ ...MOCK_PAGE, ...c.req.valid("json") }), 200)
)

pagesRouter.openapi(
  createRoute({
    method: "delete",
    path: "/pages/{id}",
    tags: ["pages"],
    summary: "Move page to trash (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(PageSchema, "Trashed"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) =>
    c.json(toDto({ ...MOCK_PAGE, deletedAt: "2026-01-02T00:00:00.000Z" }), 200)
)

pagesRouter.openapi(
  createRoute({
    method: "post",
    path: "/pages/{id}/restore",
    tags: ["pages"],
    summary: "Restore page from trash (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(PageSchema, "Restored"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto(MOCK_PAGE), 200)
)

pagesRouter.openapi(
  createRoute({
    method: "delete",
    path: "/pages/{id}/purge",
    tags: ["pages"],
    summary: "Permanently delete page (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(z.object({ deleted: z.boolean() }), "Deleted"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json({ deleted: true }, 200)
)
