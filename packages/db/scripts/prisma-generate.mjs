// Generate the Prisma client from the schema named by PRISMA_SCHEMA (default:
// the SQLite dev schema). The svc-roadmap Vercel project sets
// PRISMA_SCHEMA=schema.postgres.prisma so EVERY postinstall — however many times
// pnpm re-runs it during a build — emits the Postgres client the deployed
// function needs (its DATABASE_URL is Postgres). Ordering tricks in vercel.json
// don't hold because a stray `pnpm install` late in the pipeline re-runs
// postinstall; making postinstall itself schema-aware is order-independent.
//
// A shell one-liner can't read the env var cross-platform (Windows dev), so this
// is a tiny Node script instead.
import { execSync } from "node:child_process"

const schema = `prisma/${process.env.PRISMA_SCHEMA ?? "schema.prisma"}`
execSync(`prisma generate --schema ${schema}`, { stdio: "inherit" })
