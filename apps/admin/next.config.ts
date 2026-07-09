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

// This child zone is mounted at /admin by the web host, but it must build as a
// root app. On this pinned Next.js/Clerk combo, basePath prevents proxy.ts from
// being detected before auth(), which produces 500s on Vercel.
//
// assetPrefix makes the admin app emit asset URLs outside the web host's
// /_next namespace. In dev those URLs point at the child server; in prod the
// host rewrites /admin-static/* to this deployment.
//
// The internal rewrites below let the child deployment tolerate direct
// /admin/* hits while the canonical web host still strips /admin before
// forwarding to this app.
//
// In dev, the absolute assetPrefix points
// at its own origin (:3002). Without it, opening the zone through the web host
// at http://localhost:3000/admin 404s every `/_next/*` chunk (the host serves
// its own /_next), leaving the page stuck on skeletons. With it, the browser
// loads chunks straight from :3002, so /admin works under the :3000 host —
// which also puts web + admin on the SAME origin so they share the mock
// localStorage store and the Clerk session cookie.
const nextConfig: NextConfig = {
  assetPrefix: isProd ? "/admin-static" : "http://localhost:3002",
  allowedDevOrigins: ["localhost:3000"],
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  async rewrites() {
    return [
      { source: "/admin", destination: "/" },
      { source: "/admin/:path*", destination: "/:path*" },
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
