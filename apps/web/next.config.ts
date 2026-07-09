import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

// Native Next.js Multi-Zones: this (default/host) app proxies the child zones by
// path. Local dev defaults to the child dev servers; production uses the child
// domains. Override with ADMIN_URL / SUPER_ADMIN_URL if the domains change.
const isProd = process.env.NODE_ENV === "production"
const ADMIN_URL =
  process.env.ADMIN_URL ??
  (isProd ? "https://tlh222k-admin.vercel.app" : "http://localhost:3002")
const SUPER_ADMIN_URL =
  process.env.SUPER_ADMIN_URL ??
  (isProd ? "https://tlh222k-super-admin.vercel.app" : "http://localhost:3003")

// Child zones only carry their basePath (/admin, /super-admin) in production
// (see apps/admin|super-admin/next.config.ts — proxy.ts can't run under
// basePath in dev on this pinned Next.js build). So in dev the child servers
// answer at their bare root and the prefix must be stripped on the way in.
const ADMIN_DEST = isProd ? `${ADMIN_URL}/admin` : ADMIN_URL
const SUPER_ADMIN_DEST = isProd ? `${SUPER_ADMIN_URL}/super-admin` : SUPER_ADMIN_URL

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  async rewrites() {
    return [
      { source: "/admin", destination: ADMIN_DEST },
      { source: "/admin/:path*", destination: `${ADMIN_DEST}/:path*` },
      { source: "/super-admin", destination: SUPER_ADMIN_DEST },
      {
        source: "/super-admin/:path*",
        destination: `${SUPER_ADMIN_DEST}/:path*`,
      },
    ]
  },
}

// withSentryConfig injects the client config and (when SENTRY_AUTH_TOKEN +
// SENTRY_ORG/SENTRY_PROJECT are set, i.e. CI/prod) uploads source maps. With
// none of those env vars present it's a safe no-op, so local dev is unaffected.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only emit upload logs in CI.
  silent: !process.env.CI,
  // Broaden client source map upload for more complete stack traces.
  widenClientFileUpload: true,
})
