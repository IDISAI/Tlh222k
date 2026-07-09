import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"
import { fileURLToPath } from "node:url"

const noScriptNextThemes = fileURLToPath(
  new URL(
    "../../packages/core/src/navigation/no-script-next-themes.tsx",
    import.meta.url
  )
)

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

// Child zones build as root apps so their proxy.ts runs before Clerk auth().
// This host owns the public /admin and /super-admin prefixes, stripping them
// before forwarding to the child deployments.
const ADMIN_DEST = ADMIN_URL
const SUPER_ADMIN_DEST = SUPER_ADMIN_URL

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "next-themes": noScriptNextThemes,
    }

    return config
  },
  async rewrites() {
    return [
      {
        source: "/admin-static/:path*",
        destination: `${ADMIN_URL}/admin-static/:path*`,
      },
      { source: "/admin", destination: ADMIN_DEST },
      { source: "/admin/:path*", destination: `${ADMIN_DEST}/:path*` },
      {
        source: "/super-admin-static/:path*",
        destination: `${SUPER_ADMIN_URL}/super-admin-static/:path*`,
      },
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
