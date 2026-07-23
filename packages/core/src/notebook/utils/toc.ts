import type { TocEntry } from "../types"

/**
 * Group a notebook's heading anchors by the cell that renders them, in document
 * order. `MarkdownCell` renders one cell and cannot allocate ids that stay
 * unique across the notebook, so the host hands each cell the slugs
 * `extractToc` already assigned — which is what keeps a TOC link and its
 * heading pointing at the same place when two cells share a heading.
 */
export function headingSlugsByCell(
  toc: readonly TocEntry[]
): Map<string, string[]> {
  const byCell = new Map<string, string[]>()
  for (const entry of toc) {
    const slugs = byCell.get(entry.cellId)
    if (slugs) slugs.push(entry.slug)
    else byCell.set(entry.cellId, [entry.slug])
  }
  return byCell
}
