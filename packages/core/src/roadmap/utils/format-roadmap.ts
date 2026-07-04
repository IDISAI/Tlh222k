import type { Roadmap } from "../types"

export function formatRoadmap(item: Roadmap): string {
  return item.title.trim()
}
