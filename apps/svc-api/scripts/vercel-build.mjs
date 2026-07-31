import { execSync } from "node:child_process"

/* global process */
const env = { ...process.env }

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for svc-api build")
}

if (!env.DIRECT_URL) {
  env.DIRECT_URL = env.DATABASE_URL.replace("-pooler.", ".")
}

const acceptDataLoss = env.VERCEL_ENV === "preview" ? " --accept-data-loss" : ""

execSync(
  `pnpm -F @workspace/db exec prisma db push --schema prisma/schema.prisma${acceptDataLoss} && pnpm --filter svc-api exec nest build`,
  {
    stdio: "inherit",
    env,
  }
)
