import "dotenv/config"
import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"

// Local Prisma commands own credentials in packages/db/.env. The API has its
// own .env in deployed environments, but development needs the same database
// connection instead of silently starting against an unset datasource.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  loadEnv({ path: resolve(process.cwd(), "../../packages/db/.env") })
  // Nest keeps one connection pool open in development. Use Neon direct URL
  // here; DATABASE_URL in packages/db/.env is the serverless pooler URL.
  if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL
}
// Load Sentry before any instrumented library so OTel can patch them (order matters).
import "./instrument"
import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { configureHttpApp } from "./bootstrap"

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  configureHttpApp(app)

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────
  // Never mount in production — it maps the entire API surface for attackers.
  const swaggerEnabled = process.env.NODE_ENV !== "production"
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("svc-api API")
      .setDescription(
        "REST API cho roadmap service — chạy song song với GraphQL (/graphql).\n\n" +
          "Dùng `Authorization: Bearer <clerk_token>` cho các endpoint admin."
      )
      .setVersion("1.0")
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup("api-docs", app, document)
  }

  const port = Number(process.env.PORT ?? 3005)
  await app.listen(port)
  console.log(`svc-api listening on http://localhost:${port}/graphql`)
  if (swaggerEnabled) {
    console.log(`Swagger UI: http://localhost:${port}/api-docs`)
  }
}

void bootstrap()
