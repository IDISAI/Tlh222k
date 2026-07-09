// Sentry init for the Node.js server runtime. Loaded from instrumentation.ts's
// register() hook. DSN comes from env (SENTRY_DSN, or the public one as a
// fallback) — with no DSN set the SDK is a no-op, so local dev needs no config.
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // Off by default; opt into tracing per-env with SENTRY_TRACES_SAMPLE_RATE.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  // Requests carry Clerk auth headers — don't attach PII unless intentionally enabled.
  sendDefaultPii: false,
})
