import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const isProd = process.env.NODE_ENV === "production"

// basePath is prod-only (see admin/next.config.ts for the full rationale).
// assetPrefix (dev-only) points asset URLs at this zone's own origin (:3003)
// so the zone works when proxied through the web host at :3000/super-admin
// (otherwise every /_next chunk 404s), and web + super-admin end up on the
// same origin (shared localStorage + Clerk session).
const nextConfig: NextConfig = {
  basePath: isProd ? "/super-admin" : undefined,
  assetPrefix: isProd ? undefined : "http://localhost:3003",
  allowedDevOrigins: ["localhost:3000"],
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

// withSentryConfig injects the client config and (when SENTRY_AUTH_TOKEN +
// SENTRY_ORG/SENTRY_PROJECT are set, i.e. CI/prod) uploads source maps. With
// none of those env vars present it's a safe no-op, so local dev is unaffected.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
