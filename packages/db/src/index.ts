import { PrismaClient } from "@prisma/client"

// Singleton cached on globalThis so dev hot-reload doesn't exhaust connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

// Re-export generated model types + enums so consumers import from one place.
export * from "@prisma/client"
