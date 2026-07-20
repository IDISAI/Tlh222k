import { beforeEach, describe, expect, it } from "vitest"

import { resetStore } from "./mock/builder-store"
import { RoadmapService } from "./roadmap.service"
import { nodeNavigationUrl } from "./utils/node-navigation"

const ROLE = "admin" as const

/**
 * End-to-end journey through the LEGO redesign, exercising every phase at the
 * service contract the UI drives: create roadmap (table), create on canvas,
 * drag member, wire/retype/cut edges, remove-from-canvas vs permanent delete,
 * chapter articles, and the drill URL.
 */
describe("roadmap E2E (LEGO composition)", () => {
  beforeEach(() => resetStore())

  it("builds a roadmap end-to-end and every phase behaves", async () => {
    const svc = new RoadmapService()

    // Phase 4 — "Tạo roadmap mới" from the table = a standalone role block.
    const frontend = await svc.createBlock(
      { nodeType: "role", title: "Frontend Dev", positionX: 0, positionY: 0 },
      ROLE
    )
    let all = await svc.listNodes()
    expect(
      all.some((n) => n.id === frontend.id && n.nodeType === "role")
    ).toBe(true) // shows in table + Kho sidebar
    expect(frontend.roadmapId).toBe(frontend.id) // self-owned: block IS a roadmap

    // Phase 2 — opening its detail page = its (still empty) composition.
    let comp = await svc.getComposition(frontend.id, { callerRole: ROLE })
    expect(comp.members).toHaveLength(0)

    // Phase 3 — right-click canvas creates a skill block ON it (active member).
    const react = await svc.createBlock(
      {
        nodeType: "skill",
        title: "React",
        ownerId: frontend.id,
        positionX: 100,
        positionY: 100,
      },
      ROLE
    )
    comp = await svc.getComposition(frontend.id, { callerRole: ROLE })
    expect(comp.members.map((m) => m.nodeId)).toContain(react.id)

    // Phase 2/4 — an independent roadmap dragged from the sidebar onto A.
    const css = await svc.createBlock(
      { nodeType: "skill", title: "CSS", positionX: 0, positionY: 0 },
      ROLE
    )
    await svc.addMember(frontend.id, css.id, { x: 300, y: 100 }, ROLE)
    comp = await svc.getComposition(frontend.id, { callerRole: ROLE })
    expect(comp.members.map((m) => m.nodeId)).toEqual(
      expect.arrayContaining([react.id, css.id])
    )

    // Phase 3 — wire owner→react (solid) and react→css (dashed).
    await svc.addEdge(frontend.id, frontend.id, react.id, "solid", ROLE)
    const eReactCss = await svc.addEdge(
      frontend.id,
      react.id,
      css.id,
      "dashed",
      ROLE
    )
    comp = await svc.getComposition(frontend.id, { callerRole: ROLE })
    expect(comp.edges).toHaveLength(2)

    // Phase 3 — change a wire's kind.
    await svc.updateEdgeKind(frontend.id, eReactCss.id, "solid", ROLE)
    comp = await svc.getComposition(frontend.id, { callerRole: ROLE })
    expect(comp.edges.find((e) => e.id === eReactCss.id)?.kind).toBe("solid")

    // Phase 3 — remove react FROM THE CANVAS: its edges drop, css stays, react
    // still exists in the system (LEGO independence).
    comp = await svc.removeFromCanvas(frontend.id, react.id, ROLE)
    expect(comp.members.map((m) => m.nodeId)).not.toContain(react.id)
    expect(comp.members.map((m) => m.nodeId)).toContain(css.id)
    expect(comp.edges).toHaveLength(0) // both edges touched react
    all = await svc.listNodes()
    expect(all.find((n) => n.id === react.id)?.isDeleted).toBeFalsy()

    // Phase 5 — a chapter block with an article shown in the right panel.
    const chapter = await svc.createBlock(
      {
        nodeType: "chapter",
        title: "Hooks",
        ownerId: css.id,
        positionX: 0,
        positionY: 0,
      },
      ROLE
    )
    const article = await svc.createNode(
      {
        roadmapId: chapter.roadmapId,
        parentId: chapter.id,
        title: "useState",
        nodeType: "article",
        articleType: "jupyter",
        jupyterUrl: "https://example.com/nb",
        positionX: 0,
        positionY: 0,
      },
      ROLE
    )
    all = await svc.listNodes()
    const chapterArticles = all.filter(
      (n) =>
        n.parentId === chapter.id && n.nodeType === "article" && !n.isDeleted
    )
    expect(chapterArticles.map((a) => a.id)).toContain(article.id)

    // Drill URL — a block's detail is its own composition canvas.
    expect(nodeNavigationUrl(css, { builderBasePath: "/roadmaps" })).toBe(
      `/roadmaps/${css.id}`
    )

    // Phase 4 — permanent delete css: purged from frontend's canvas + soft
    // deleted system-wide.
    await svc.deleteBlockPermanent(css.id, ROLE)
    comp = await svc.getComposition(frontend.id, { callerRole: ROLE })
    expect(comp.members.map((m) => m.nodeId)).not.toContain(css.id)
    all = await svc.listNodes()
    expect(all.find((n) => n.id === css.id)?.isDeleted).toBe(true)
  })
})
