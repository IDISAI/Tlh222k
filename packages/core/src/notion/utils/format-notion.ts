import type { Notion } from "../types"

export function formatNotion(item: Notion): string {
  return item.title.trim()
}
