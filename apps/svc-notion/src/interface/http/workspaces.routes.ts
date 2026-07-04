// ponytail: contract-only — real data flows through GraphQL (/graphql).
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { MOCK_PAGE_SUMMARY, MOCK_WORKSPACE } from "./mocks"
import {
  IdParam,
  jsonBody,
  jsonContent,
  PageSummarySchema,
  toDto,
  WorkspaceSchema,
} from "./schemas"

export const workspacesRouter = new OpenAPIHono()

workspacesRouter.openapi(
  createRoute({
    method: "get",
    path: "/workspaces",
    tags: ["workspaces"],
    summary: "List workspaces (mock)",
    responses: { 200: jsonContent(z.array(WorkspaceSchema), "OK") },
  }),
  (c) => c.json(toDto([MOCK_WORKSPACE]), 200)
)

workspacesRouter.openapi(
  createRoute({
    method: "post",
    path: "/workspaces",
    tags: ["workspaces"],
    summary: "Create workspace (mock)",
    request: jsonBody(z.object({ name: z.string().min(1).max(100) })),
    responses: { 201: jsonContent(WorkspaceSchema, "Created") },
  }),
  (c) => c.json(toDto({ ...MOCK_WORKSPACE, name: c.req.valid("json").name }), 201)
)

workspacesRouter.openapi(
  createRoute({
    method: "get",
    path: "/workspaces/{id}/pages",
    tags: ["pages"],
    summary: "Page tree of a workspace (mock)",
    request: { params: IdParam },
    responses: { 200: jsonContent(z.array(PageSummarySchema), "OK") },
  }),
  (c) => c.json(toDto([MOCK_PAGE_SUMMARY]), 200)
)

workspacesRouter.openapi(
  createRoute({
    method: "get",
    path: "/workspaces/{id}/trash",
    tags: ["pages"],
    summary: "Trashed pages of a workspace (mock)",
    request: { params: IdParam },
    responses: { 200: jsonContent(z.array(PageSummarySchema), "OK") },
  }),
  (c) => c.json(toDto([]), 200)
)

workspacesRouter.openapi(
  createRoute({
    method: "get",
    path: "/workspaces/{id}/search",
    tags: ["search"],
    summary: "Search pages by title (mock)",
    request: {
      params: IdParam,
      query: z.object({ q: z.string().min(1).max(200) }),
    },
    responses: { 200: jsonContent(z.array(PageSummarySchema), "OK") },
  }),
  (c) => c.json(toDto([MOCK_PAGE_SUMMARY]), 200)
)
