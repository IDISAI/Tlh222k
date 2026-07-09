import "dotenv/config"
// Load Sentry before any instrumented library so OTel can patch them (order matters).
import "./instrument"
import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  const origins = (
    process.env.FRONTEND_ORIGINS ??
    "http://localhost:3000,http://localhost:3002,http://localhost:3003"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)

  app.enableCors({
    origin: origins,
    credentials: true,
    // Allow the Clerk bearer token + SSE.
    allowedHeaders: ["Content-Type", "Authorization"],
  })

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle("svc-roadmap API")
    .setDescription(
      "REST API cho roadmap service — chạy song song với GraphQL (/graphql).\n\n" +
      "Dùng `Authorization: Bearer <clerk_token>` cho các endpoint admin."
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup("api-docs", app, document)

  const port = Number(process.env.PORT ?? 3005)
  await app.listen(port)
  console.log(`svc-roadmap listening on http://localhost:${port}/graphql`)
  console.log(`Swagger UI: http://localhost:${port}/api-docs`)
}

void bootstrap()

