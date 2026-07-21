"use client"

import { PanelRightClose, PencilLine, Trash2 } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import type { RoadmapNode } from "../../types"

interface BlockContextMenuProps {
  node: RoadmapNode
  /** The owner renders pinned and can't be removed from its own canvas. */
  isOwner: boolean
  screenX: number
  screenY: number
  onClose: () => void
  onEdit: (node: RoadmapNode) => void
  /** Remove from THIS canvas only (membership + its edges). Not permanent. */
  onRemoveFromCanvas: (node: RoadmapNode) => void
  /** Permanent system delete (purges the block from every canvas). */
  onDeletePermanent: (node: RoadmapNode) => void
}

/**
 * Right-click menu on a canvas block. "Gỡ khỏi canvas" removes only membership
 * (LEGO: other canvases and the block itself survive); "Xóa vĩnh viễn" removes
 * it from the whole system.
 */
export function BlockContextMenu({
  node,
  isOwner,
  screenX,
  screenY,
  onClose,
  onEdit,
  onRemoveFromCanvas,
  onDeletePermanent,
}: BlockContextMenuProps) {
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
        <button
          type="button"
          className={item}
          onClick={() => {
            onEdit(node)
            onClose()
          }}
        >
          <PencilLine className="size-4" /> Chỉnh sửa
        </button>
        {!isOwner && (
          <button
            type="button"
            className={item}
            onClick={() => {
              onRemoveFromCanvas(node)
              onClose()
            }}
          >
            <PanelRightClose className="size-4" /> Gỡ khỏi canvas
          </button>
        )}
        <button
          type="button"
          className={cn(item, "text-destructive hover:text-destructive")}
          onClick={() => {
            onDeletePermanent(node)
            onClose()
          }}
        >
          <Trash2 className="size-4" /> Xóa vĩnh viễn
        </button>
      </div>
    </>
  )
}
