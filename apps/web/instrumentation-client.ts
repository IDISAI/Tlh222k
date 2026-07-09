// Client-side instrumentation (Next.js file convention) — runs in the browser
// before hydration. DSN must be a NEXT_PUBLIC_* var to be inlined into the
// client bundle; without it the SDK is a no-op. onRouterTransitionStart lets
// Sentry trace App Router client navigations.
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
  ),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
