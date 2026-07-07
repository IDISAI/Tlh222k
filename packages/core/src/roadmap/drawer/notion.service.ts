import { MOCK_NOTION } from "../mock"

/**
 * In-core fallback used by the app's /api/notion/[pageId] route handler.
 * ponytail: the route handler will call svc-notion instead of this map.
 */
export function getMockMarkdown(pageId: string): string | null {
  return MOCK_NOTION[pageId] ?? null
}
