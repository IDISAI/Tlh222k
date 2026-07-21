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
      updateMany: vi.fn(),
    },
    document: {
      updateMany: vi.fn(),
    },
  }
  const prisma = {
    ...tx,
    $transaction: vi.fn(
      async (
        work: (client: typeof tx) => unknown,
        _opts?: { timeout?: number; isolationLevel?: string }
      ) => work(tx)
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

  it("field-only updateNode skips Serializable (avoids create→link deadlocks)", async () => {
    const { service, tx, prisma } = harness()
    const article = node("article-1", "roadmap-a")
    tx.node.findUnique.mockResolvedValue(article)
    tx.node.update.mockResolvedValue({
      ...article,
      notionPageId: "doc-1",
    })
    tx.node.count = vi.fn(async () => 0)

    await service.updateNode(
      article.id,
      { notionPageId: "doc-1" },
      admin
    )

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 10_000,
    })
    expect(prisma.$transaction.mock.calls[0]?.[1]).not.toHaveProperty(
      "isolationLevel"
    )
  })

  it("parent-change updateNode keeps Serializable isolation", async () => {
    const { service, tx, prisma } = harness()
    const child = node("child", "roadmap-a")
    const parent = node("parent", "roadmap-a")
    tx.node.findUnique.mockResolvedValue(child)
    tx.node.findFirst.mockResolvedValue(parent)
    tx.node.findMany.mockResolvedValue([child, parent])
    tx.node.update.mockResolvedValue({ ...child, parentId: parent.id })
    tx.node.count = vi.fn(async () => 0)

    await service.updateNode(child.id, { parentId: parent.id }, admin)

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 10_000,
      isolationLevel: "Serializable",
    })
  })

  it("moves a node into another roadmap and detaches its children", async () => {
    const { service, tx, events } = harness()
    const moved = node("moved", "roadmap-b")
    tx.node.findUnique.mockResolvedValue(moved)
    tx.node.update.mockResolvedValue({
      ...moved,
      roadmapId: "roadmap-a",
      parentId: null,
      positionX: 10,
      positionY: 20,
    })

    const result = await service.moveNode("moved", "roadmap-a", 10, 20, admin)

    expect(tx.node.updateMany).toHaveBeenCalledWith({
      where: { parentId: "moved" },
      data: { parentId: null },
    })
    expect(tx.node.update).toHaveBeenCalledWith({
      where: { id: "moved" },
      data: {
        roadmapId: "roadmap-a",
        parentId: null,
        positionX: 10,
        positionY: 20,
        order: 0,
      },
    })
    expect(result.roadmapId).toBe("roadmap-a")
    // Both the source and the target roadmap get an update event.
    expect(events.emit).toHaveBeenCalledWith("roadmap-b")
    expect(events.emit).toHaveBeenCalledWith("roadmap-a")
  })

  it("refuses to move a deleted node", async () => {
    const { service, tx } = harness()
    tx.node.findUnique.mockResolvedValue({
      ...node("ghost", "roadmap-b"),
      isDeleted: true,
    })

    await expect(
      service.moveNode("ghost", "roadmap-a", 0, 0, admin)
    ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } })
    expect(tx.node.update).not.toHaveBeenCalled()
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
