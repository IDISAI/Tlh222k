import type { NodeStatus } from "../../types"

/**
 * Property 3: exactly one class string per status; all three are distinct.
 * Palette follows DESIGN_SYSTEM.md §5 (neo-brutalist node states).
 */
export const NODE_STATUS_COLORS: Record<NodeStatus, string> = {
  locked:
    "bg-zinc-50 border-zinc-300 text-zinc-600 dark:bg-zinc-900/60 dark:border-zinc-700 dark:text-zinc-400",
  in_progress:
    "bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-950/40 dark:border-amber-500 dark:text-amber-300",
  done: "bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-300",
}
