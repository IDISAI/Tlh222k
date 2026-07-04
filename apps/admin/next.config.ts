import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  basePath: "/admin", // Multi-Zones: served under /admin via the web host
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

export default nextConfig
