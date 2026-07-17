// Sentry init for the Edge runtime (middleware / edge routes). Loaded from
// instrumentation.ts when NEXT_RUNTIME === "edge". Same env-driven DSN as the
// server config; no DSN means the SDK stays disabled.
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  sendDefaultPii: false,
})
