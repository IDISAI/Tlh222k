import { beforeEach, describe, expect, it } from "vitest"

import { resetStore } from "./mock/builder-store"
import { RoadmapService } from "./roadmap.service"

const ROLE = "admin" as const

/** Composition model (LEGO redesign): membership + edges, mock-backed. */
describe("RoadmapService composition", () => {
  let svc: RoadmapService

  beforeEach(() => {
    resetStore()
    svc = new RoadmapService()
  })

  async function block(nodeType: "role" | "skill" | "chapter", title: string) {
    return svc.createBlock({ nodeType, title, positionX: 0, positionY: 0 }, ROLE)
  }

  it("derives an empty canvas for a childless block", async () => {
    const owner = await block("role", "Frontend")
    const comp = await svc.getComposition(owner.id, { callerRole: ROLE })
    expect(comp.ownerId).toBe(owner.id)
    expect(comp.members).toHaveLength(0)
    expect(comp.edges).toHaveLength(0)
  })

  it("createBlock with ownerId places the new block on that canvas", async () => {
    const owner = await block("role", "Frontend")
    const child = await svc.createBlock(
      { nodeType: "skill", title: "React", ownerId: owner.id, positionX: 10, positionY: 20 },
      ROLE
    )
    const comp = await svc.getComposition(owner.id, { callerRole: ROLE })
    expect(comp.members.map((m) => m.nodeId)).toContain(child.id)
  })

  it("removeFromCanvas drops the block + its edges but keeps others", async () => {
    const owner = await block("role", "Frontend")
    const a = await block("skill", "React")
    const b = await block("skill", "CSS")
    await svc.addMember(owner.id, a.id, { x: 0, y: 0 }, ROLE)
    await svc.addMember(owner.id, b.id, { x: 0, y: 0 }, ROLE)
    await svc.addEdge(owner.id, a.id, b.id, "dashed", ROLE) // A→B (touches A)
    await svc.addEdge(owner.id, owner.id, b.id, "solid", ROLE) // owner→B (kept)

    const comp = await svc.removeFromCanvas(owner.id, a.id, ROLE)

    expect(comp.members.map((m) => m.nodeId)).not.toContain(a.id)
    expect(comp.members.map((m) => m.nodeId)).toContain(b.id)
    // Edge A→B is gone; owner→B survives (LEGO: only A's links are cut).
    expect(comp.edges).toHaveLength(1)
    expect(comp.edges[0]).toMatchObject({ sourceId: owner.id, targetId: b.id })
  })

  it("addEdge upserts the kind for the same pair", async () => {
    const owner = await block("role", "Frontend")
    const a = await block("skill", "React")
    await svc.addMember(owner.id, a.id, { x: 0, y: 0 }, ROLE)
    await svc.addEdge(owner.id, owner.id, a.id, "solid", ROLE)
    const again = await svc.addEdge(owner.id, owner.id, a.id, "dashed", ROLE)
    const comp = await svc.getComposition(owner.id, { callerRole: ROLE })
    expect(comp.edges).toHaveLength(1)
    expect(again.kind).toBe("dashed")
  })

  it("deleteBlockPermanent purges the block from every canvas", async () => {
    const owner = await block("role", "Frontend")
    const a = await block("skill", "React")
    await svc.addMember(owner.id, a.id, { x: 0, y: 0 }, ROLE)
    await svc.addEdge(owner.id, owner.id, a.id, "solid", ROLE)

    await svc.deleteBlockPermanent(a.id, ROLE)

    const comp = await svc.getComposition(owner.id, { callerRole: ROLE })
    expect(comp.members).toHaveLength(0)
    expect(comp.edges).toHaveLength(0)
    const nodes = await svc.listNodes()
    expect(nodes.find((n) => n.id === a.id)?.isDeleted).toBe(true)
  })
})
