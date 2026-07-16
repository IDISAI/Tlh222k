// Serverless bootstrap, compiled by `nest build` (tsc) so decorator metadata is
// emitted — NestJS DI depends on it. The Vercel function (api/index.ts) is a
// thin wrapper that re-exports this from the built dist/, avoiding esbuild
// (which drops emitDecoratorMetadata and would break DI).
//
// Nest boots once per warm container; the Express instance is reused across
// invocations. Env comes from Vercel project settings (no dotenv here).
import "./instrument"
import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import type { Request, Response } from "express"
import { AppModule } from "./app.module"
import { configureHttpApp } from "./bootstrap"

let cachedHandler: ((req: Request, res: Response) => void) | null = null

async function bootstrap(): Promise<(req: Request, res: Response) => void> {
  const app = await NestFactory.create(AppModule)
  configureHttpApp(app)

  // Never mount in production — it maps the entire API surface for attackers.
  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("svc-api API")
      .setDescription(
        "REST API cho roadmap service — chạy song song với GraphQL (/graphql)."
      )
      .setVersion("1.0")
      .addBearerAuth()
      .build()
    SwaggerModule.setup(
      "api-docs",
      app,
      SwaggerModule.createDocument(app, swaggerConfig)
    )
  }

  await app.init()
  return app.getHttpAdapter().getInstance()
}

export default async function handler(
  req: Request,
  res: Response
): Promise<void> {
  if (!cachedHandler) cachedHandler = await bootstrap()
  cachedHandler(req, res)
}
