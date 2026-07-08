import { BookOpen, FileText, Gem, Hexagon } from "lucide-react"

import { NODE_TYPE_LEVEL, type NodeType } from "../../types"

/** Design legend: ⬡ role (blue), ◈ skill (purple), ▣ chapter (orange), ▷ article (green). */
export const NODE_TYPE_ICONS: Record<NodeType, typeof Hexagon> = {
  role: Hexagon,
  skill: Gem,
  chapter: BookOpen,
  article: FileText,
}

/** Neo-brutalist card colors per NodeType (matches the viewer node card shell). */
export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  role: "bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-200",
  skill:
    "bg-purple-50 border-purple-500 text-purple-900 dark:bg-purple-950/50 dark:border-purple-500 dark:text-purple-200",
  chapter:
    "bg-orange-50 border-orange-500 text-orange-900 dark:bg-orange-950/50 dark:border-orange-500 dark:text-orange-200",
  article:
    "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-200",
}

/** Compact accent (sidebar icons, badges). */
export const NODE_TYPE_ACCENT: Record<NodeType, string> = {
  role: "text-blue-600 dark:text-blue-400",
  skill: "text-purple-600 dark:text-purple-400",
  chapter: "text-orange-600 dark:text-orange-400",
  article: "text-emerald-600 dark:text-emerald-400",
}

export function nodeTypeLabel(type: NodeType): string {
  return `${type} (cấp ${NODE_TYPE_LEVEL[type]})`
}
