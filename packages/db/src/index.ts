import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/client"

// ponytail: globalThis singleton so Next.js dev HMR doesn't leak connections
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// node-postgres ignores ?schema= in the URL (Prisma-CLI-only param) — parse it
// out and hand it to the adapter so runtime and CLI hit the same schema.
const connectionString = process.env.DATABASE_URL
const schema = connectionString
  ? (new URL(connectionString).searchParams.get("schema") ?? undefined)
  : undefined

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }, { schema }),
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export * from "../generated/client"
