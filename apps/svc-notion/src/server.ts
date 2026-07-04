import "dotenv/config"

import { serve } from "@hono/node-server"

import { app } from "./app"

const port = Number(process.env.PORT ?? 3004)

serve({ fetch: app.fetch, port })

console.log(
  `svc-notion listening on http://localhost:${port}  (Swagger: /docs, GraphQL: /graphql)`
)
