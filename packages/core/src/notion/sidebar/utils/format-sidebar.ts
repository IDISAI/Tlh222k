import type { Sidebar } from "../types"

export function formatSidebar(item: Sidebar): string {
  return item.title.trim()
}
