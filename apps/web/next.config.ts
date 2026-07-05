import type { NextConfig } from "next"
import { withMicrofrontends } from "@vercel/microfrontends/next/config"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
}

// Default app of the microfrontends group (hosts microfrontends.json).
export default withMicrofrontends(nextConfig)
