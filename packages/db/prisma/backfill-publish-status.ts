/**
 * Backfills `publishStatus` from the legacy `isPublished` boolean.
 *
 * Idempotent: every row is written to the value its boolean already implies, so
 * running it twice changes nothing and running it after a later deploy simply
 * re-asserts the same answer. It writes rather than skips, because a row added
 * by `db push` carries the column default rather than its own truth.
 *
 * Fields are the exception. A Field has never had a publish state and every one
 * of them is visible today, so they all become PUBLISHED. Starting them at
 * DRAFT would empty the browse strip the moment a reader moves across — a
 * silent regression dressed as a migration. Publishing rules apply from here
 * on; they are not applied retroactively to content already live.
 *
 *   pnpm -F @workspace/db exec tsx prisma/backfill-publish-status.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const published = await prisma.roadmap.updateMany({
    where: { isPublished: true },
    data: { publishStatus: "PUBLISHED" },
  })
  const drafted = await prisma.roadmap.updateMany({
    where: { isPublished: false },
    data: { publishStatus: "DRAFT" },
  })
  const nodesPublished = await prisma.node.updateMany({
    where: { isPublished: true },
    data: { publishStatus: "PUBLISHED" },
  })
  const nodesDrafted = await prisma.node.updateMany({
    where: { isPublished: false },
    data: { publishStatus: "DRAFT" },
  })
  const fields = await prisma.field.updateMany({
    data: { publishStatus: "PUBLISHED" },
  })

  console.log(
    JSON.stringify(
      {
        roadmaps: { published: published.count, draft: drafted.count },
        nodes: { published: nodesPublished.count, draft: nodesDrafted.count },
        fields: { published: fields.count },
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
