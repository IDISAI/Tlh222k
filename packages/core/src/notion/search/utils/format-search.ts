import type { Search } from "../types"

export function formatSearch(item: Search): string {
  return item.title.trim()
}
