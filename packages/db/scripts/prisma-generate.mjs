// Generate the Prisma client on every postinstall. Single Postgres schema now
// (Neon for dev + prod), so no PRISMA_SCHEMA branching — runs however many times
// pnpm re-invokes postinstall during a Vercel build; binaryTargets in the schema
// emit the Linux query engine the deployed function needs.
import { execSync } from "node:child_process"

execSync("prisma generate --schema prisma/schema.prisma", { stdio: "inherit" })
