import type { Composition, Roadmap, RoadmapNode } from "../types"
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
  return { roadmaps, nodes, compositions: [] }
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
