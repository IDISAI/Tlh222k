import type { RoadmapNode } from "../types"
import { TOAST_MESSAGES } from "../builder/utils/toast-messages"
import { resolveArticleTarget } from "./resolve-article-target"

export interface NodeNavigationOptions {
  notebookBasePath?: string
  notionBasePath?: string
  /**
   * Slug of the article's parent chapter. Notion articles open a workspace
   * ROOTED at the chapter (its whole page tree in the sidebar) with the
   * article page pre-selected via `?page=`. Falls back to the article's own
   * slug when the parent isn't known (keeps a valid link).
   */
  parentChapterSlug?: string
  /**
   * Admin-builder base ("/roadmaps"). When set, chapter navigates to its
   * Roadmap_Detail_Page (`{base}/{roadmapId}/chapter/{slug}`, Req 10.1) and
   * role/skill navigates to its LINKED roadmap's builder (`{base}/{id}`,
   * Req 11.5). Omitted in viewer zones → `/roadmap/{slug}` as before.
   */
  builderBasePath?: string
}

/**
 * Resolve the destination the "Điều hướng" action opens.
 *
 * Viewer zones (no `builderBasePath`): role/skill/chapter → a same-origin
 * `/roadmap/[slug]` viewer. Admin builder (`builderBasePath` set): chapter →
 * its Roadmap_Detail_Page (Req 10.1); role/skill → the linked roadmap's
 * builder, or null when `linkedRoadmapId` is unset (Req 11.5/11.6).
 *
 * Notion articles REQUIRE a non-null `notionPageId` (Req 1.2/1.3) — an
 * unlinked node returns null so the caller shows the "chưa được tạo" toast.
 */
export function nodeNavigationUrl(
  node: RoadmapNode,
  opts: NodeNavigationOptions = {}
): string | null {
  const {
    notebookBasePath = "/learn",
    notionBasePath = "/notion",
    parentChapterSlug,
    builderBasePath,
  } = opts

  if (node.nodeType === "chapter") {
    if (builderBasePath) {
      if (!node.slug) return null // Req 10.6
      return `${builderBasePath}/${node.roadmapId}/chapter/${node.slug}`
    }
    return node.slug ? `/roadmap/${node.slug}` : null
  }
  if (node.nodeType === "role" || node.nodeType === "skill") {
    if (builderBasePath) {
      // Req 11.5/11.6: builder navigates into the LINKED roadmap only.
      return node.linkedRoadmapId
        ? `${builderBasePath}/${node.linkedRoadmapId}`
        : null
    }
    return `/roadmap/${node.slug}`
  }
  if (node.nodeType === "article") {
    const target = resolveArticleTarget(node)
    if (target) {
      if (target.kind === "external") return target.url
      if (node.articleType === "notion") {
        if (!node.notionPageId) return null // Req 1.3: unlinked notion node
        const chapterSlug = parentChapterSlug ?? node.slug
        return `${notionBasePath}/${chapterSlug}?page=${encodeURIComponent(
          node.slug
        )}`
      }
      return `${notebookBasePath}/${target.slug}`
    }
  }
  return null
}

/** Vietnamese toast body when navigation is impossible for this node. */
export function navigationBlockedMessage(node: RoadmapNode): string {
  if (node.nodeType === "chapter") return "Không thể điều hướng đến chapter này"
  if (node.nodeType === "role" || node.nodeType === "skill") {
    return "Node này chưa được liên kết với roadmap nào."
  }
  if (node.nodeType === "article" && node.articleType === "notion") {
    return "Trang Notion chưa được tạo cho node này"
  }
  return TOAST_MESSAGES.ARTICLE_NO_LINK
}
