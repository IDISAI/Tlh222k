"use client"

import { Minus, Unlink } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import { EDGE_KINDS, type EdgeKind, type RoadmapEdge } from "../../types"

interface EdgeContextMenuProps {
  edge: RoadmapEdge
  screenX: number
  screenY: number
  onClose: () => void
  onSetKind: (edgeId: string, kind: EdgeKind) => void
  onRemove: (edgeId: string) => void
}

const KIND_LABEL: Record<EdgeKind, string> = {
  solid: "Nét liền",
  dashed: "Nét đứt",
}

/** Right-click menu on a wire: switch its kind or cut the link (Req: dây). */
export function EdgeContextMenu({
  edge,
  screenX,
  screenY,
  onClose,
  onSetKind,
  onRemove,
}: EdgeContextMenuProps) {
  const left = Math.max(8, Math.min(screenX, window.innerWidth - 228))
  const top = Math.max(8, Math.min(screenY, window.innerHeight - 200))

  const item =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        role="menu"
        className="fixed z-50 w-[220px] rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
        style={{ left, top }}
      >
        <p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Loại dây
        </p>
        {EDGE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={cn(item, edge.kind === kind && "bg-accent")}
            onClick={() => {
              onSetKind(edge.id, kind)
              onClose()
            }}
          >
            <Minus
              className={cn("size-4", kind === "dashed" && "opacity-60")}
              strokeDasharray={kind === "dashed" ? "3 2" : undefined}
            />
            {KIND_LABEL[kind]}
          </button>
        ))}
        <div className="my-1 border-t" />
        <button
          type="button"
          className={cn(item, "text-destructive hover:text-destructive")}
          onClick={() => {
            onRemove(edge.id)
            onClose()
          }}
        >
          <Unlink className="size-4" /> Hủy liên kết
        </button>
      </div>
    </>
  )
}
