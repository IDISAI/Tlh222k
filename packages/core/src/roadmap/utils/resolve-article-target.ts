import type { RoadmapNode } from "../types"

/** Where clicking an article node should take the user. */
export type ArticleTarget =
  | { kind: "external"; url: string }
  | { kind: "internal"; slug: string }

/**
 * Routing rule for article nodes — both document kinds are INTERNAL features
 * now (legacy external URL metadata is superseded):
 * - jupyter (any legacy jupyterUrl)  → notebook viewer/editor at
 *   `<notebookBasePath>/[slug]`
 * - notion (any legacy notionPageId) → notion workspace at
 *   `<notionBasePath>/[slug]`
 * - anything else (unlinked)         → null (caller shows the "not linked"
 *   warning)
 */
export function resolveArticleTarget(node: RoadmapNode): ArticleTarget | null {
  if (node.nodeType !== "article") return null
  if (node.articleType === "jupyter" || node.articleType === "notion") {
    return { kind: "internal", slug: node.slug }
  }
  return null
}
