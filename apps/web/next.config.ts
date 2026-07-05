import type { NextConfig } from "next"

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
