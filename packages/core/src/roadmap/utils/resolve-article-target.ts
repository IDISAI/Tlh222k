import type { RoadmapNode } from "../types"

/** Where clicking an article node should take the user. */
export type ArticleTarget =
  | { kind: "external"; url: string }
  | { kind: "internal"; slug: string }

/**
 * Routing rule for article nodes (internal Jupyter notebooks supersede legacy
 * external URL metadata):
 * - notion + linked page        → external Notion URL
 * - jupyter (any legacy URL)    → INTERNAL notebook viewer at /learn/[slug]
 * - anything else (unlinked)    → null (caller shows the "not linked" warning)
 */
export function resolveArticleTarget(node: RoadmapNode): ArticleTarget | null {
  if (node.nodeType !== "article") return null
  if (node.articleType === "jupyter") {
    return { kind: "internal", slug: node.slug }
  }
  if (node.articleType === "notion" && node.notionPageId) {
    return { kind: "external", url: `https://notion.so/${node.notionPageId}` }
  }
  return null
}
