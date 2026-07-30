import type { Composition, Field, Roadmap, RoadmapNode } from "../types"
import { reachesLearners, statusOf } from "../publish-status"
import { MOCK_NODES } from "./nodes.mock"
import { MOCK_ROADMAPS } from "./roadmaps.mock"

/**
 * Mutable mock store backing the admin CRUD methods of `RoadmapService`.
 * Seeded from the static mocks; in the browser every mutation is persisted to
 * localStorage so builder edits survive reloads and are visible to the viewer
 * tab on the same origin (the web host proxies the admin zone).
 * ponytail: the whole file disappears once svc-roadmap serves GraphQL.
 */

const STORAGE_KEY = "roadmap-builder:store:v1"

export interface BuilderStore {
  roadmaps: Roadmap[]
  fields: Field[]
  /** Flat list across all roadmaps; soft-deleted nodes stay with isDeleted=true. */
  nodes: RoadmapNode[]
  /**
   * Per-owner canvas compositions (LEGO model). Empty until the first edit —
   * `RoadmapService.getComposition` derives from the parentId tree meanwhile.
   */
  compositions: Composition[]
}

function seed(): BuilderStore {
  const roadmaps = MOCK_ROADMAPS.map((r) => ({ ...r }))
  const nodes = Object.values(MOCK_NODES).flatMap((list) =>
    list.map((n) => ({ ...n }))
  )
  const fields: Field[] = [
    { id: "field-ai", title: "AI", slug: "ai", order: 0, description: "Explore practical paths through artificial intelligence.", imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1800&q=85", publishStatus: "PUBLISHED" },
    { id: "field-data", title: "Data", slug: "data", order: 1, description: "Build confidence with data systems, analysis, and decisions.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85", publishStatus: "PUBLISHED" },
    { id: "field-web", title: "Web development", slug: "web-development", order: 2, description: "Make useful, resilient products for the web.", imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1800&q=85", publishStatus: "PUBLISHED" },
  ]
  const publishedRoadmapIds = new Set(
    roadmaps
      .filter((roadmap) => reachesLearners(statusOf(roadmap)))
      .map((roadmap) => roadmap.id)
  )
  return {
    roadmaps,
    fields,
    nodes: nodes.map((node, index) => ({
      ...node,
      // Seed public role/skill blocks for Explorer. Legacy node fixtures do not
      // carry a publish state, while their parent roadmaps already do.
      publishStatus: publishedRoadmapIds.has(node.roadmapId) ? "PUBLISHED" : "DRAFT",
      isPublished: publishedRoadmapIds.has(node.roadmapId),
      fields: node.nodeType === "role" || node.nodeType === "skill" ? [fields[index % fields.length]!] : [],
    })),
    compositions: [],
  }
}

let store: BuilderStore | null = null
let hydrated = false

function isStoreShape(value: unknown): value is BuilderStore {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  // `compositions` is intentionally not required — older payloads predate it.
  return Array.isArray(v.roadmaps) && Array.isArray(v.nodes)
}

/** Lazy singleton; browser sessions hydrate persisted edits over the seed. */
export function getStore(): BuilderStore {
  if (!store) store = seed()
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isStoreShape(parsed)) store = parsed
      }
    } catch {
      // Corrupt / legacy payload — keep the seed and overwrite on next persist.
    }
  }
  // Backfill for payloads persisted before the composition model existed.
  if (!Array.isArray(store.compositions)) store.compositions = []
  if (!Array.isArray(store.fields)) store.fields = seed().fields
  // Backfill persisted stores created before Field Explorer needed a block's
  // explicit publish status. This is local-only migration, no data loss.
  //
  // A browser's localStorage payload from before this migration existed can
  // still carry the old `isPublished` boolean the current types no longer
  // declare — read it defensively as unknown legacy shape, same as the
  // "Corrupt / legacy payload" handling just above.
  const publishedRoadmapIds = new Set(
    store.roadmaps
      .filter(
        (roadmap) => (roadmap as unknown as { isPublished?: boolean }).isPublished
      )
      .map((roadmap) => roadmap.id)
  )
  store.nodes.forEach((node) => {
    if (node.publishStatus === undefined) {
      node.publishStatus = publishedRoadmapIds.has(node.roadmapId) ? "PUBLISHED" : "DRAFT"
    }
  })
  return store
}

export function persistStore(): void {
  if (typeof window === "undefined" || !store) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota/privacy failures are non-fatal for a mock backend.
  }
}

/** Test/dev helper: drop all persisted edits and re-seed. */
export function resetStore(): void {
  store = seed()
  hydrated = true
  persistStore()
}
