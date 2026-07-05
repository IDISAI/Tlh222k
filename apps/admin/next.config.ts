import type { NextConfig } from "next"
import { withMicrofrontends } from "@vercel/microfrontends/next/config"

const nextConfig: NextConfig = {
  basePath: "/admin", // Multi-Zones: served under /admin via the web host
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

export default withMicrofrontends(nextConfig)
