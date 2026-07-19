"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  PanelLeftClose,
  Search,
  Trash2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { NODE_TYPES, type NodeType, type RoadmapNode } from "../../types"
import { useDebouncedValue } from "../hooks/use-debounced-value"
import {
  NODE_TYPE_ACCENT,
  NODE_TYPE_COLORS,
  NODE_TYPE_ICONS,
} from "../utils/node-type-styles"
import { NODE_DND_MIME } from "../types"
import { DeleteNodeDialog } from "./DeleteNodeDialog"

interface NodeSidebarProps {
  /** Every node in the system (Req 3.6). Permanently-deleted ones are filtered out. */
  allNodes: RoadmapNode[]
  /** Nodes currently on the canvas — highlighted with an active colored border. */
  canvasNodeIds: ReadonlySet<string>
  /** Permanent system delete after confirmation (Req 4.2/4.3). */
  onDeletePermanent: (node: RoadmapNode) => Promise<void> | void
  /** Collapse the panel (toggle handled by the parent). */
  onCollapse?: () => void
}

/** Total descendants of a node (cascade preview for the confirm dialog). */
function descendantCount(nodes: RoadmapNode[], rootId: string): number {
  let count = 0
  let frontier = [rootId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const n of nodes) {
      if (n.parentId && frontier.includes(n.parentId)) {
        count++
        next.push(n.id)
      }
    }
    frontier = next
  }
  return count
}

/**
 * Kho Node — persistent right panel grouped by NodeType with 300ms debounced
 * search (Req 3.6/4.1). Deliberately not a modal Sheet: an overlay backdrop
 * would swallow the HTML5 drag-drop onto the canvas.
 */
export function NodeSidebar({
  allNodes,
  canvasNodeIds,
  onDeletePermanent,
  onCollapse,
}: NodeSidebarProps) {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const [collapsed, setCollapsed] = useState<Partial<Record<NodeType, boolean>>>({})
  const [deleteTarget, setDeleteTarget] = useState<RoadmapNode | null>(null)

  const visible = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allNodes
      // Permanently-deleted nodes disappear from the sidebar entirely.
      .filter((n) => !n.isDeleted)
      .filter((n) => !q || n.title.toLowerCase().includes(q))
  }, [allNodes, debouncedSearch])

  const grouped = useMemo(() => {
    const groups = {} as Record<NodeType, RoadmapNode[]>
    for (const type of NODE_TYPES) {
      groups[type] = visible.filter((n) => n.nodeType === type)
    }
    return groups
  }, [visible])

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r bg-background">
      <div className="border-b p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">📋 Kho Node</h2>
          {onCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Thu gọn Kho Node"
              onClick={onCollapse}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Tìm kiếm node..."
            className="pl-8"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {NODE_TYPES.map((type) => {
          const Icon = NODE_TYPE_ICONS[type]
          const items = grouped[type]
          const isCollapsed = collapsed[type] ?? false
          return (
            <section key={type}>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [type]: !isCollapsed }))
                }
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                <Icon className={cn("size-3.5", NODE_TYPE_ACCENT[type])} />
                {type}
                <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px]">
                  {items.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="mt-1.5 space-y-1.5">
                  {items.length === 0 && (
                    <p className="px-1 text-xs italic text-muted-foreground">
                      Không có node
                    </p>
                  )}
                  {items.map((node) => {
                    // Nodes already on the canvas get an active border tinted
                    // to their NodeType color (instead of being hidden).
                    const onCanvas = canvasNodeIds.has(node.id)
                    return (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            NODE_DND_MIME,
                            JSON.stringify(node)
                          )
                          e.dataTransfer.effectAllowed = "move"
                        }}
                        title={onCanvas ? "Đang có trên Canvas" : undefined}
                        className={cn(
                          "group flex cursor-grab items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent active:cursor-grabbing",
                          onCanvas && cn("border-2 font-medium", NODE_TYPE_COLORS[type])
                        )}
                      >
                        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                        <Icon
                          className={cn("size-4 shrink-0", NODE_TYPE_ACCENT[type])}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {node.title}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100"
                          title="Xóa vĩnh viễn khỏi hệ thống"
                          onClick={() => setDeleteTarget(node)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {deleteTarget && (
        <DeleteNodeDialog
          node={deleteTarget}
          childCount={descendantCount(allNodes, deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await onDeletePermanent(deleteTarget)
            setDeleteTarget(null)
          }}
        />
      )}
    </aside>
  )
}
