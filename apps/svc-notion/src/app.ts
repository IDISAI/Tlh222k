import { readFileSync } from "node:fs"

import { ApolloServer, HeaderMap } from "@apollo/server"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { swaggerUI } from "@hono/swagger-ui"
import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"

import { buildContext } from "./interface/graphql/context"
import type { GraphQLContext } from "./interface/graphql/context"
import { resolvers } from "./interface/graphql/resolvers"
import { collabRouter } from "./interface/http/collab.routes"
import { databasesRouter } from "./interface/http/databases.routes"
import { pagesRouter } from "./interface/http/pages.routes"
import { workspacesRouter } from "./interface/http/workspaces.routes"

// Schema SDL is the single source of truth (codegen types both sides).
// Vercel: vercel.json includeFiles ships it next to the function bundle.
const typeDefs = readFileSync(
  new URL("./interface/graphql/schema.graphql", import.meta.url),
  "utf-8"
)

const apollo = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: true,
  // Apollo Sandbox embedded at GET /graphql (all envs — this service is the sandbox)
  plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
})
await apollo.start()

const origins = (
  process.env.CORS_ORIGINS ??
  "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"
).split(",")

export const app = new OpenAPIHono()

app.use("*", cors({ origin: origins, credentials: true }))

app.get("/", (c) =>
  c.json({
    service: "svc-notion",
    graphql: "/graphql (real data — Apollo Sandbox)",
    docs: "/docs (REST contract — mock data only)",
    openapi: "/openapi.json",
  })
)

// REST = contract-only mocks for Swagger
app.route("/", workspacesRouter)
app.route("/", pagesRouter)
app.route("/", databasesRouter)
app.route("/", collabRouter)

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "svc-notion (REST contract)",
    version: "0.2.0",
    description:
      "CONTRACT ONLY: every REST endpoint returns static mock data for exploration. Real reads/writes go through GraphQL at /graphql (Apollo Sandbox).",
  },
})
app.get("/docs", swaggerUI({ url: "/openapi.json" }))

// GraphQL — the real API. Bridge Hono's Web Request into Apollo Server.
app.all("/graphql", async (c) => {
  const request = c.req.raw
  const headers = new HeaderMap()
  request.headers.forEach((value, key) => headers.set(key, value))

  const response = await apollo.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: request.method.toUpperCase(),
      headers,
      search: new URL(request.url).search,
      body:
        request.method === "POST"
          ? await c.req.json().catch(() => ({}))
          : undefined,
    },
    context: () => buildContext(request),
  })

  const out = new Headers()
  for (const [key, value] of response.headers) out.set(key, value)

  let body = ""
  if (response.body.kind === "complete") {
    body = response.body.string
  } else {
    for await (const chunk of response.body.asyncIterator) body += chunk
  }
  return new Response(body, { status: response.status ?? 200, headers: out })
})

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: "Internal error" }, 500)
})
