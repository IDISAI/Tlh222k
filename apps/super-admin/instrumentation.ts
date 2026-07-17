// Server-side instrumentation entrypoint (Next.js file convention). register()
// runs once per server instance; it loads the runtime-specific Sentry config.
// onRequestError forwards uncaught server errors (RSC, route handlers, actions)
// to Sentry.
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
