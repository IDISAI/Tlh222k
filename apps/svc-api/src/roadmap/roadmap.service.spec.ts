import { describe, expect, it, vi } from "vitest"

import { RoadmapService } from "./roadmap.service"

const admin = { userId: "admin-1", role: "admin" as const }

function node(id: string, roadmapId: string, parentId: string | null = null) {
  return {
    id,
    roadmapId,
    parentId,
    title: id,
    slug: id,
    description: null,
    nodeType: "article",
    notionPageId: null,
    articleType: null,
    jupyterUrl: null,
    positionX: 0,
    positionY: 0,
    order: 0,
    isDeleted: false,
    linkedRoadmapId: null,
    isPublished: false,
  }
}

function harness() {
  const tx = {
    roadmap: {
      findUnique: vi.fn(async () => ({ id: "roadmap-a" })),
    },
    node: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(async () => 0),
      update: vi.fn(),
    },
    document: {
      updateMany: vi.fn(),
    },
  }
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx)
    ),
  }
  const events = { emit: vi.fn() }
  return {
    tx,
    prisma,
    events,
    service: new RoadmapService(prisma as never, events as never),
  }
}

describe("RoadmapService tree integrity", () => {
  it("rejects a parent from another roadmap before update", async () => {
    const { service, tx } = harness()
    const child = node("child", "roadmap-a")
    const foreignParent = node("foreign-parent", "roadmap-b")
    tx.node.findUnique.mockResolvedValue(child)
    tx.node.findFirst.mockResolvedValue(foreignParent)
    tx.node.findMany.mockResolvedValue([child])
    tx.node.update.mockResolvedValue({ ...child, parentId: foreignParent.id })

    await expect(
      service.updateNode(child.id, { parentId: foreignParent.id }, admin)
    ).rejects.toMatchObject({ extensions: { code: "INVALID_HIERARCHY" } })
    expect(tx.node.update).not.toHaveBeenCalled()
  })

  it("rejects a parent change that creates a cycle", async () => {
    const { service, tx } = harness()
    const root = node("root", "roadmap-a")
    const child = node("child", "roadmap-a", root.id)
    tx.node.findUnique.mockResolvedValue(root)
    tx.node.findFirst.mockResolvedValue(child)
    tx.node.findMany.mockResolvedValue([root, child])
    tx.node.update.mockResolvedValue({ ...root, parentId: child.id })

    await expect(
      service.updateNode(root.id, { parentId: child.id }, admin)
    ).rejects.toMatchObject({ extensions: { code: "INVALID_HIERARCHY" } })
    expect(tx.node.update).not.toHaveBeenCalled()
  })

  it("rejects save nodes that do not belong to route roadmap", async () => {
    const { service, tx } = harness()
    tx.node.findMany.mockResolvedValue([node("owned", "roadmap-a")])
    tx.node.update.mockResolvedValue(node("foreign", "roadmap-b"))

    await expect(
      service.saveRoadmap(
        "roadmap-a",
        [{ id: "foreign", parentId: null, positionX: 1, positionY: 2 }],
        admin
      )
    ).rejects.toMatchObject({ extensions: { code: "INVALID_HIERARCHY" } })
    expect(tx.node.update).not.toHaveBeenCalled()
  })

  it("passes Prisma timeout and Serializable options", async () => {
    const { service, tx, prisma } = harness()
    const owned = node("owned", "roadmap-a")
    tx.node.findMany.mockResolvedValue([owned])
    tx.node.update.mockResolvedValue(owned)

    await service.saveRoadmap(
      "roadmap-a",
      [{ id: owned.id, parentId: null, positionX: 1, positionY: 2 }],
      admin
    )

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 10_000,
      isolationLevel: "Serializable",
    })
  })

  it("maps Prisma interactive transaction timeout to domain timeout", async () => {
    const { service, prisma } = harness()
    prisma.$transaction.mockRejectedValue(
      Object.assign(new Error("expired"), { code: "P2028" })
    )

    await expect(
      service.saveRoadmap("roadmap-a", [], admin)
    ).rejects.toMatchObject({
      extensions: { code: "TIMEOUT" },
    })
  })
})
