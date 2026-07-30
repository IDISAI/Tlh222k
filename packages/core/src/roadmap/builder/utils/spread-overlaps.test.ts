import { describe, expect, it } from "vitest"

import {
  layoutForCanvas,
  NODE_CARD,
  nextFreeSlot,
  spreadOverlaps,
} from "./spread-overlaps"

describe("layoutForCanvas", () => {
  it("clears cards that are distinct but too close for the current card size", () => {
    // The stored layout was arranged when a card was a 168x40 pill. The card
    // is now 238x248, so neighbours an admin left 100px apart overlap.
    const laid = layoutForCanvas([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 100 },
    ])
    expect(Math.abs(laid[1]!.y - laid[0]!.y)).toBeGreaterThanOrEqual(
      NODE_CARD.height
    )
  })

  it("scales uniformly, so the arrangement keeps its shape", () => {
    // Scaling each axis by its own ratio would distort what the admin drew:
    // a diagonal becomes steeper, a square becomes a rectangle. Every canvas
    // opens with fitView, so a uniform scale looks identical — just unstacked.
    const laid = layoutForCanvas([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 0, y: 100 },
    ])
    const dx = laid[1]!.x - laid[0]!.x
    const dy = laid[2]!.y - laid[0]!.y
    expect(dx).toBeCloseTo(dy, 5)
  })

  it("leaves a canvas that already has room untouched", () => {
    const roomy = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 1000, y: 1000 },
    ]
    expect(layoutForCanvas(roomy)).toEqual(roomy)
  })

  it("separates a pile of identical coordinates before scaling", () => {
    // Scaling cannot separate identical points — 0 x anything is still 0 — so
    // the pile has to be fanned out first.
    const laid = layoutForCanvas([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 0, y: 0 },
    ])
    const seen = new Set(laid.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`))
    expect(seen.size).toBe(3)
  })

  it("leaves a single node alone", () => {
    expect(layoutForCanvas([{ id: "a", x: 5, y: 7 }])).toEqual([
      { id: "a", x: 5, y: 7 },
    ])
  })
})

describe("spreadOverlaps", () => {
  it("leaves a canvas whose nodes are already apart exactly as it found it", () => {
    const placed = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 600, y: 0 },
      { id: "c", x: 0, y: 600 },
    ]
    expect(spreadOverlaps(placed)).toEqual(placed)
  })

  it("fans out nodes stacked on the same coordinate", () => {
    // The real state of the database: blocks created from the CMS table all
    // arrive at (0,0), so they render as one card with the rest hidden under it.
    const spread = spreadOverlaps([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 0, y: 0 },
    ])
    const seen = new Set(spread.map((n) => `${n.x},${n.y}`))
    expect(seen.size).toBe(3)
  })

  it("keeps the first node of a stack where it was", () => {
    // Something has to stay put or the whole canvas drifts on every load.
    const spread = spreadOverlaps([
      { id: "a", x: 40, y: 90 },
      { id: "b", x: 40, y: 90 },
    ])
    expect(spread[0]).toEqual({ id: "a", x: 40, y: 90 })
  })

  it("separates a stack by at least a card plus a gutter", () => {
    const spread = spreadOverlaps([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
    ])
    const dx = Math.abs(spread[1]!.x - spread[0]!.x)
    const dy = Math.abs(spread[1]!.y - spread[0]!.y)
    expect(dx >= NODE_CARD.width || dy >= NODE_CARD.height).toBe(true)
  })

  it("does not drop a node onto a coordinate another node already holds", () => {
    // The far node sits exactly where the naive "one column right" answer
    // would put the second of the stacked pair.
    const spread = spreadOverlaps([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "far", x: NODE_CARD.width + 40, y: 0 },
    ])
    const seen = new Set(spread.map((n) => `${n.x},${n.y}`))
    expect(seen.size).toBe(3)
  })

  it("is stable — running it twice changes nothing further", () => {
    const once = spreadOverlaps([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 0, y: 0 },
    ])
    expect(spreadOverlaps(once)).toEqual(once)
  })

  it("preserves input order, so React keys and z-order do not shuffle", () => {
    const spread = spreadOverlaps([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
    ])
    expect(spread.map((n) => n.id)).toEqual(["a", "b"])
  })

  it("handles an empty canvas", () => {
    expect(spreadOverlaps([])).toEqual([])
  })
})

describe("nextFreeSlot", () => {
  it("returns the origin for an empty canvas", () => {
    expect(nextFreeSlot([])).toEqual({ x: 0, y: 0 })
  })

  it("never returns a spot a node already occupies", () => {
    const taken = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: NODE_CARD.width + 40, y: 0 },
    ]
    const slot = nextFreeSlot(taken)
    expect(taken.some((n) => n.x === slot.x && n.y === slot.y)).toBe(false)
  })
})
