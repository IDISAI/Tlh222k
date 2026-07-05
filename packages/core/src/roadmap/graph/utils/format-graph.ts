import type { Graph } from "../types"

export function formatGraph(item: Graph): string {
  return item.title.trim()
}
