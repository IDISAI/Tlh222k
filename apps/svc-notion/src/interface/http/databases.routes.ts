// ponytail: contract-only — real data flows through GraphQL (/graphql).
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { MOCK_DATABASE, MOCK_PAGE, MOCK_VIEW } from "./mocks"
import {
  DatabaseSchema,
  DatabaseWithViewsSchema,
  ErrorSchema,
  IdParam,
  jsonBody,
  jsonContent,
  PageSchema,
  PropertyDefSchema,
  toDto,
  ViewConfigSchema,
  ViewSchema,
  ViewTypeSchema,
} from "./schemas"

export const databasesRouter = new OpenAPIHono()

databasesRouter.openapi(
  createRoute({
    method: "post",
    path: "/pages/{id}/database",
    tags: ["databases"],
    summary: "Turn a page into a database (mock)",
    request: {
      params: IdParam,
      ...jsonBody(z.object({ propertySchema: z.array(PropertyDefSchema).min(1) })),
    },
    responses: {
      201: jsonContent(DatabaseSchema, "Created"),
      404: jsonContent(ErrorSchema, "Page not found"),
    },
  }),
  (c) =>
    c.json(
      toDto({ ...MOCK_DATABASE, propertySchema: c.req.valid("json").propertySchema }),
      201
    )
)

databasesRouter.openapi(
  createRoute({
    method: "get",
    path: "/databases/{id}",
    tags: ["databases"],
    summary: "Get database with views (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(DatabaseWithViewsSchema, "OK"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto({ ...MOCK_DATABASE, views: [MOCK_VIEW] }), 200)
)

databasesRouter.openapi(
  createRoute({
    method: "patch",
    path: "/databases/{id}",
    tags: ["databases"],
    summary: "Update property schema (mock)",
    request: {
      params: IdParam,
      ...jsonBody(z.object({ propertySchema: z.array(PropertyDefSchema).min(1) })),
    },
    responses: {
      200: jsonContent(DatabaseSchema, "Updated"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) =>
    c.json(
      toDto({ ...MOCK_DATABASE, propertySchema: c.req.valid("json").propertySchema }),
      200
    )
)

databasesRouter.openapi(
  createRoute({
    method: "get",
    path: "/databases/{id}/rows",
    tags: ["databases"],
    summary: "List rows; viewId applies its filters/sorts (mock)",
    request: {
      params: IdParam,
      query: z.object({ viewId: z.string().optional() }),
    },
    responses: {
      200: jsonContent(z.array(PageSchema), "OK"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto([MOCK_PAGE]), 200)
)

databasesRouter.openapi(
  createRoute({
    method: "post",
    path: "/databases/{id}/rows",
    tags: ["databases"],
    summary: "Add row (mock)",
    request: {
      params: IdParam,
      ...jsonBody(
        z.object({
          title: z.string().max(500).nullish(),
          properties: z.unknown().optional(),
        })
      ),
    },
    responses: {
      201: jsonContent(PageSchema, "Created"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto(MOCK_PAGE), 201)
)

databasesRouter.openapi(
  createRoute({
    method: "post",
    path: "/databases/{id}/views",
    tags: ["views"],
    summary: "Add view (mock)",
    request: {
      params: IdParam,
      ...jsonBody(
        z.object({
          type: ViewTypeSchema,
          name: z.string().min(1).max(100),
          config: ViewConfigSchema.optional(),
        })
      ),
    },
    responses: {
      201: jsonContent(ViewSchema, "Created"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto({ ...MOCK_VIEW, ...c.req.valid("json") }), 201)
)

databasesRouter.openapi(
  createRoute({
    method: "patch",
    path: "/views/{id}",
    tags: ["views"],
    summary: "Update view (mock)",
    request: {
      params: IdParam,
      ...jsonBody(
        z.object({
          type: ViewTypeSchema.optional(),
          name: z.string().min(1).max(100).optional(),
          config: ViewConfigSchema.optional(),
        })
      ),
    },
    responses: {
      200: jsonContent(ViewSchema, "Updated"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json(toDto({ ...MOCK_VIEW, ...c.req.valid("json") }), 200)
)

databasesRouter.openapi(
  createRoute({
    method: "delete",
    path: "/views/{id}",
    tags: ["views"],
    summary: "Delete view (mock)",
    request: { params: IdParam },
    responses: {
      200: jsonContent(z.object({ deleted: z.boolean() }), "Deleted"),
      404: jsonContent(ErrorSchema, "Not found"),
    },
  }),
  (c) => c.json({ deleted: true }, 200)
)
