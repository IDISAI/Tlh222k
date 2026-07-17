import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"
import { fileURLToPath } from "node:url"

const isProd = process.env.NODE_ENV === "production"
const noScriptNextThemes = fileURLToPath(
  new URL(
    "../../packages/core/src/navigation/no-script-next-themes.tsx",
    import.meta.url
  )
)

// Build as a root app and let the web host mount it at /super-admin. Keeping a
// Next basePath here makes Clerk auth() run without proxy.ts coverage on the
// pinned Next.js build, causing Vercel 500s.
//
// In dev, assetPrefix points at the child server. In prod, the web host rewrites
// /super-admin-static/* to this deployment so assets do not collide with the
// host app's /_next namespace.
const nextConfig: NextConfig = {
  assetPrefix: isProd ? "/super-admin-static" : "http://localhost:3003",
  allowedDevOrigins: ["localhost:3000"],
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  async rewrites() {
    return [
      { source: "/super-admin", destination: "/" },
      { source: "/super-admin/:path*", destination: "/:path*" },
    ]
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "next-themes": noScriptNextThemes,
    }

    return config
  },
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
