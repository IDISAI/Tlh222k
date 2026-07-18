import { ValidationPipe, type INestApplication } from "@nestjs/common"

import { isAllowedOrigin } from "./http/cors"

const LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3003",
] as const

function configuredOrigins(env: NodeJS.ProcessEnv): string[] {
  const configured = (env.FRONTEND_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (configured.length > 0 || env.NODE_ENV === "production") return configured
  return [...LOCAL_ORIGINS]
}

/** Apply the same request validation and CORS policy to every Nest bootstrap. */
export function configureHttpApp(
  app: Pick<INestApplication, "enableCors" | "useGlobalPipes">,
  env: NodeJS.ProcessEnv = process.env
): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  const origins = configuredOrigins(env)
  const productionWithoutAllowlist =
    env.NODE_ENV === "production" && origins.length === 0
  app.enableCors({
    origin: (origin, callback) => {
      const allowed = productionWithoutAllowlist
        ? !origin
        : isAllowedOrigin(origin, origins)
      callback(null, allowed)
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
}
