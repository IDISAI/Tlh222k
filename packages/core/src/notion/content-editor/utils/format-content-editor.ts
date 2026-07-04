import type { ContentEditor } from "../types"

export function formatContentEditor(item: ContentEditor): string {
  return item.title.trim()
}
