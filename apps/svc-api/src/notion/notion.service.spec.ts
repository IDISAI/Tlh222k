import { describe, expect, it, vi } from "vitest"

import { NotionService } from "./notion.service"

const admin = { userId: "admin-1", role: "admin" as const }

function document(id: string, parentDocumentId: string | null = null) {
  const now = new Date("2026-07-16T00:00:00.000Z")
  return {
    id,
    slug: null,
    title: id,
    authorId: admin.userId,
    isArchived: false,
    parentDocumentId,
    content: null,
    coverImage: null,
    icon: null,
    isPublished: false,
    position: 0,
    createdAt: now,
    updatedAt: now,
  }
}

describe("NotionService.move", () => {
  it("serializes moves and uses a cycle-safe recursive query", async () => {
    const calls: string[] = []
    const recursiveSql: string[] = []
    const doc = document("doc")
    const parent = document("parent")
    const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?")
      if (sql.includes("pg_advisory_xact_lock")) {
        calls.push("lock")
        return [{ pg_advisory_xact_lock: null }]
      }
      calls.push("subtree")
      recursiveSql.push(sql)
      return [{ id: doc.id }]
    })
    const tx = {
      $queryRaw: queryRaw,
      document: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          calls.push(`find:${where.id}`)
          return where.id === doc.id ? doc : parent
        }),
        count: vi.fn(async () => 0),
        update: vi.fn(async () => ({ ...doc, parentDocumentId: parent.id })),
      },
    }
    const prisma = {
      ...tx,
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
        work(tx)
      ),
    }
    const service = new NotionService(prisma as never)

    await service.move(admin, doc.id, parent.id)

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 10_000,
      isolationLevel: "Serializable",
    })
    expect(calls[0]).toBe("lock")
    expect(recursiveSql).toHaveLength(1)
    expect(recursiveSql[0]).toContain("UNION")
    expect(recursiveSql[0]).not.toContain("UNION ALL")
  })
})

describe("NotionService public responses", () => {
  it("omits authorId from viewer notion responses", async () => {
    const published = { ...document("published"), isPublished: true }
    const prisma = {
      document: {
        findUnique: vi.fn(async () => published),
      },
    }
    const service = new NotionService(prisma as never)

    const result = await service.getById(null, published.id)

    expect(result).not.toHaveProperty("authorId")
  })
})
