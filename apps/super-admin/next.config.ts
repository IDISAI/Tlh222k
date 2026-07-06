import type { NextConfig } from "next"

// basePath is prod-only: this pinned Next.js build never invokes proxy.ts
// (so Clerk's clerkMiddleware can't be detected, and auth() throws) when
// basePath is set. In dev we're hit directly on :3003 with no prefix, so
// there's nothing to strip; production still needs it for the Multi-Zone
// rewrite from the web host.
const nextConfig: NextConfig = {
  basePath: process.env.NODE_ENV === "production" ? "/super-admin" : undefined,
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

export default nextConfig
