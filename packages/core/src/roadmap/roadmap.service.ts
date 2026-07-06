import type { NodeStatus, Roadmap, RoadmapGraph, RoadmapNode } from "./types"
import { MOCK_NODES, MOCK_ROADMAPS } from "./mock"

const LATENCY_MS = 150
const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms))

/**
 * Roadmap domain service. Currently mock-backed; each method maps 1:1 onto a
 * GraphQL operation so the body can be swapped without touching callers.
 */
export class RoadmapService {
  // ponytail: → `roadmaps` query
  async list(): Promise<Roadmap[]> {
    await delay()
    return MOCK_ROADMAPS.filter((r) => r.isPublished)
  }

  // ponytail: → `roadmap(slug)` query
  async bySlug(slug: string): Promise<Roadmap | null> {
    await delay()
    return MOCK_ROADMAPS.find((r) => r.slug === slug) ?? null
  }

  /**
   * Full graph for a roadmap. Guests (`authenticated: false`) always receive
   * every node "locked" (Property 4). Authenticated viewers get their persisted
   * status overlaid from `progress`.
   * ponytail: → `roadmapGraph(slug)` query (status personalized server-side)
   */
  async graphBySlug(
    slug: string,
    opts: { authenticated: boolean; progress?: Record<string, NodeStatus> } = {
      authenticated: false,
    }
  ): Promise<RoadmapGraph | null> {
    await delay()
    const roadmap = MOCK_ROADMAPS.find((r) => r.slug === slug)
    const baseNodes = MOCK_NODES[slug]
    if (!roadmap || !baseNodes) return null

    const nodes: RoadmapNode[] = baseNodes.map((n) => ({
      ...n,
      status: opts.authenticated ? (opts.progress?.[n.id] ?? "locked") : "locked",
    }))
    return { roadmap, nodes }
  }
}
