import type { NodeStatus, RoadmapProgress } from "../types"
import { MOCK_NODES, MOCK_ROADMAPS } from "../mock"

const STORAGE_KEY = "roadmap:progress"

export type ProgressMap = Record<string, NodeStatus>

function read(): ProgressMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProgressMap) : {}
  } catch {
    return {}
  }
}

function write(map: ProgressMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / serialization errors */
  }
}

/**
 * Progress store. Mock persistence is localStorage keyed by `(nodeId)`; the
 * upsert is idempotent (Property 10 / P2). ponytail: swap for the
 * `setNodeStatus` mutation + `myProgress` query.
 */
export class ProgressService {
  getAll(): ProgressMap {
    return read()
  }

  getStatus(nodeId: string): NodeStatus {
    return read()[nodeId] ?? "locked"
  }

  // ponytail: → `setNodeStatus(nodeId, status)` mutation
  async set(nodeId: string, status: NodeStatus): Promise<void> {
    // Simulate network so optimistic UI is observable.
    await new Promise((r) => setTimeout(r, 120))
    // Opt-in failure path to exercise rollback (Property 9): in devtools run
    // `globalThis.__ROADMAP_FAIL__ = true` then update a node.
    if ((globalThis as Record<string, unknown>).__ROADMAP_FAIL__ === true) {
      throw new Error("mock: setNodeStatus failed")
    }
    const map = read()
    map[nodeId] = status // upsert by nodeId — never duplicates (P2)
    write(map)
  }

  // ponytail: → `myProgress` query
  async myProgress(): Promise<RoadmapProgress[]> {
    const map = read()
    const result: RoadmapProgress[] = []
    for (const roadmap of MOCK_ROADMAPS) {
      const nodes = MOCK_NODES[roadmap.slug] ?? []
      const statuses = nodes.map((n) => map[n.id] ?? "locked")
      // Property 12: include only roadmaps with ≥1 non-locked node.
      if (!statuses.some((s) => s !== "locked")) continue
      result.push({
        roadmapId: roadmap.id,
        roadmapTitle: roadmap.title,
        doneCount: statuses.filter((s) => s === "done").length,
        totalCount: nodes.length,
      })
    }
    return result
  }
}
