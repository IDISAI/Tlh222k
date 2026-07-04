import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  basePath: "/super-admin", // Multi-Zones: served under /super-admin via the web host
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

export default nextConfig
