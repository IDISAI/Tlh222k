import type { NextConfig } from "next"
import { withMicrofrontends } from "@vercel/microfrontends/next/config"

const nextConfig: NextConfig = {
  basePath: "/super-admin", // Multi-Zones: served under /super-admin via the web host
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

export default withMicrofrontends(nextConfig)
