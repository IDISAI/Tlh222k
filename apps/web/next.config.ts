import type { NextConfig } from "next"

// Multi-Zones host: proxy child zones. URLs from env in prod; localhost in dev.
const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3002"
const SUPER_ADMIN_URL = process.env.SUPER_ADMIN_URL ?? "http://localhost:3003"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  async rewrites() {
    return [
      { source: "/admin", destination: `${ADMIN_URL}/admin` },
      { source: "/admin/:path*", destination: `${ADMIN_URL}/admin/:path*` },
      { source: "/super-admin", destination: `${SUPER_ADMIN_URL}/super-admin` },
      {
        source: "/super-admin/:path*",
        destination: `${SUPER_ADMIN_URL}/super-admin/:path*`,
      },
    ]
  },
}

export default nextConfig
