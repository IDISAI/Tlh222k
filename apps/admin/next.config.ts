import type { NextConfig } from "next"

const isProd = process.env.NODE_ENV === "production"

// basePath is prod-only: this pinned Next.js build never invokes proxy.ts
// (so Clerk's clerkMiddleware can't be detected, and auth() throws) when
// basePath is set. In dev we're hit directly on :3002 with no prefix.
//
// assetPrefix (dev-only) makes the admin app emit ABSOLUTE asset URLs pointing
// at its own origin (:3002). Without it, opening the zone through the web host
// at http://localhost:3000/admin 404s every `/_next/*` chunk (the host serves
// its own /_next), leaving the page stuck on skeletons. With it, the browser
// loads chunks straight from :3002, so /admin works under the :3000 host —
// which also puts web + admin on the SAME origin so they share the mock
// localStorage store and the Clerk session cookie.
const nextConfig: NextConfig = {
  basePath: isProd ? "/admin" : undefined,
  assetPrefix: isProd ? undefined : "http://localhost:3002",
  allowedDevOrigins: ["localhost:3000"],
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

export default nextConfig
