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

let cachedHandler: ((req: Request, res: Response) => void) | null = null

async function bootstrap(): Promise<(req: Request, res: Response) => void> {
  const app = await NestFactory.create(AppModule)

  const origins = (process.env.FRONTEND_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
  // Vercel preview deploys get a per-commit hostname (e.g.
  // tlh222k-web-<hash>-idis.vercel.app) a static allowlist can't enumerate.
  // Match this project's web/admin/super-admin *.vercel.app deploys so previews
  // aren't blocked by CORS while production stays explicit via FRONTEND_ORIGINS.
  const previewOrigin =
    /^https:\/\/tlh222k-(web|admin|super-admin)[\w-]*\.vercel\.app$/
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        !origins.length ||
        origins.includes(origin) ||
        previewOrigin.test(origin)
      ) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })

  const swaggerConfig = new DocumentBuilder()
    .setTitle("svc-roadmap API")
    .setDescription("REST API cho roadmap service — chạy song song với GraphQL (/graphql).")
    .setVersion("1.0")
    .addBearerAuth()
    .build()
  SwaggerModule.setup("api-docs", app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.init()
  return app.getHttpAdapter().getInstance()
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!cachedHandler) cachedHandler = await bootstrap()
  cachedHandler(req, res)
}
