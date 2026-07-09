// Sentry init for the NestJS service. This MUST be imported before any other
// module (@nestjs/core, express, graphql) so Sentry's OpenTelemetry auto-
// instrumentation can patch them — see main.ts, where it's imported right after
// dotenv/config (so SENTRY_DSN is populated) and before everything else.
//
// DSN comes from env; with no DSN set the SDK is a no-op.
import * as Sentry from "@sentry/nestjs"

const dsn = process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // Off by default; opt into tracing per-env with SENTRY_TRACES_SAMPLE_RATE.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  sendDefaultPii: false,
})
