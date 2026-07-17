import { describe, expect, it } from "vitest"

import { assertAcyclicTree } from "./tree-invariants"

describe("assertAcyclicTree", () => {
  it("accepts a valid forest", () => {
    expect(() =>
      assertAcyclicTree([
        { id: "root-a", parentId: null },
        { id: "child-a", parentId: "root-a" },
        { id: "root-b", parentId: null },
      ])
    ).not.toThrow()
  })

  it.each([
    {
      nodes: [
        { id: "duplicate", parentId: null },
        { id: "duplicate", parentId: null },
      ],
      reason: "duplicate ids",
    },
    { nodes: [{ id: "self", parentId: "self" }], reason: "self-parent" },
    {
      nodes: [{ id: "orphan", parentId: "missing" }],
      reason: "dangling parent",
    },
    {
      nodes: [
        { id: "a", parentId: "b" },
        { id: "b", parentId: "a" },
      ],
      reason: "cycle",
    },
  ])("rejects $reason", ({ nodes }) => {
    expect(() => assertAcyclicTree(nodes)).toThrowError(
      expect.objectContaining({ extensions: { code: "INVALID_HIERARCHY" } })
    )
  })
})
