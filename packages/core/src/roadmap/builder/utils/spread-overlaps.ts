export interface PlacedNode {
  id: string
  x: number
  y: number
}

/**
 * The block card as it renders. Keep in step with `BuilderNodeComponent`.
 */
export const NODE_CARD = { width: 238, height: 248 }

/** Breathing room between two cards, so they read as separate objects. */
const GUTTER = 40

const COLUMN = NODE_CARD.width + GUTTER
const ROW = NODE_CARD.height + GUTTER

/** How many cards to place across before starting a new row. */
const COLUMNS_PER_ROW = 4

const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`

/**
 * The first grid slot no node is standing on.
 *
 * Used when creating a block: every block created from the CMS table used to
 * arrive at (0, 0), which is why a canvas of twenty roadmaps rendered as one
 * card with nineteen hidden underneath it.
 */
export function nextFreeSlot(placed: readonly PlacedNode[]): {
  x: number
  y: number
} {
  const taken = new Set(placed.map((node) => key(node.x, node.y)))
  for (let index = 0; ; index += 1) {
    const x = (index % COLUMNS_PER_ROW) * COLUMN
    const y = Math.floor(index / COLUMNS_PER_ROW) * ROW
    if (!taken.has(key(x, y))) return { x, y }
  }
}

/**
 * Fan out nodes that share a coordinate, leaving everything else untouched.
 *
 * Existing canvases hold 27 nodes at exactly (0, 0) — they were created before
 * anything assigned a position. Rendering them faithfully means stacking them,
 * so the top card swallows every click meant for the ones beneath it and the
 * canvas looks empty apart from one block.
 *
 * Only exact collisions move. A layout an admin actually arranged is left
 * alone, because rearranging their work to satisfy a spacing rule would be a
 * worse bug than the one being fixed. The first node of each stack keeps its
 * place so the canvas does not drift every time it loads, and input order is
 * preserved so React keys and z-order stay put.
 *
 * Render-time only: nothing is written back, so an admin dragging a card still
 * saves exactly where they dropped it.
 */
export function spreadOverlaps(nodes: readonly PlacedNode[]): PlacedNode[] {
  // Every coordinate the input already uses. A relocated card must avoid these
  // too, or fanning one pile out drops a member onto an unrelated block that
  // happened to sit where the grid wanted to go.
  const originals = new Set(nodes.map((node) => key(node.x, node.y)))
  const occupied = new Set<string>()
  const result: PlacedNode[] = []

  for (const node of nodes) {
    const own = key(node.x, node.y)
    if (!occupied.has(own)) {
      // First node at this coordinate keeps it — including every node on a
      // canvas an admin actually arranged, which is the common case.
      occupied.add(own)
      result.push(node)
      continue
    }

    let index = 0
    let slot = { x: 0, y: 0 }
    for (;;) {
      slot = {
        x: (index % COLUMNS_PER_ROW) * COLUMN,
        y: Math.floor(index / COLUMNS_PER_ROW) * ROW,
      }
      const candidate = key(slot.x, slot.y)
      if (!occupied.has(candidate) && !originals.has(candidate)) break
      index += 1
    }
    occupied.add(key(slot.x, slot.y))
    result.push({ id: node.id, x: slot.x, y: slot.y })
  }

  return result
}

/**
 * The smallest uniform factor that clears every overlap, or 1 if there is none.
 *
 * Uniform on purpose: scaling each axis by its own ratio keeps the layout
 * compact but distorts what the admin arranged — a diagonal chain becomes a
 * steeper one, a square becomes a rectangle. Because every canvas opens with
 * `fitView`, a uniform scale looks identical to the stored layout at a zoom
 * level where the cards no longer collide.
 */
function clearingFactor(nodes: readonly PlacedNode[]): number {
  let factor = 1
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!
      const b = nodes[j]!
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      // Two cards clear each other as soon as ONE axis separates them, so the
      // cheaper axis decides — requiring both would spread the canvas far more
      // than it needs.
      const needed = Math.min(
        dx > 0 ? COLUMN / dx : Infinity,
        dy > 0 ? ROW / dy : Infinity
      )
      if (Number.isFinite(needed) && needed > factor) factor = needed
    }
  }
  return factor
}

/**
 * Turn stored coordinates into ones the current card can be rendered at.
 *
 * Two separate problems, in order:
 *
 * 1. Blocks created from the CMS table all arrived at (0, 0) — 27 of them in
 *    the database today. Scaling cannot separate identical points, so they are
 *    fanned onto a grid first.
 * 2. The card grew from a 168x40 pill to a 238x248 cover card without the
 *    stored coordinates changing, so neighbours an admin left 100px apart now
 *    overlap by about 150px. One uniform scale clears them.
 *
 * Render-time only. Nothing is written back, so an admin dragging a card still
 * saves exactly where they dropped it, and a future change to the card size
 * corrects itself.
 */
export function layoutForCanvas(nodes: readonly PlacedNode[]): PlacedNode[] {
  const spread = spreadOverlaps(nodes)
  const factor = clearingFactor(spread)
  if (factor === 1) return spread
  return spread.map((node) => ({
    id: node.id,
    x: node.x * factor,
    y: node.y * factor,
  }))
}
