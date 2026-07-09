"use client"

import { Eraser, PencilLine, Plus } from "lucide-react"

import type { RoadmapNode } from "../../types"
import { allowedChildTypes } from "../../utils/validate-hierarchy"

interface NodeContextMenuProps {
  node: RoadmapNode
  screenX: number
  screenY: number
  onClose: () => void
  onEdit: (node: RoadmapNode) => void
  onAddChild: (node: RoadmapNode) => void
  onRemoveFromCanvas: (node: RoadmapNode) => void
}

/**
 * Right-click menu on a canvas node. Removing a node here only takes it off the
 * canvas (it returns to the "Kho Node" sidebar) — permanent deletion lives
 * exclusively in the sidebar. Disabled_Node ghosts only offer "Xóa khỏi Canvas".
 */
export function NodeContextMenu({
  node,
  screenX,
  screenY,
  onClose,
  onEdit,
  onAddChild,
  onRemoveFromCanvas,
}: NodeContextMenuProps) {
  const left = Math.max(8, Math.min(screenX, window.innerWidth - 228))
  const top = Math.max(8, Math.min(screenY, window.innerHeight - 180))
  const canHaveChildren = allowedChildTypes(node.nodeType).length > 0

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
        {node.isDeleted ? (
          <button
            type="button"
            className={item}
            onClick={() => {
              onRemoveFromCanvas(node)
              onClose()
            }}
          >
            <Eraser className="size-4" /> Xóa khỏi Canvas
          </button>
        ) : (
          <>
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
            {canHaveChildren && (
              <button
                type="button"
                className={item}
                onClick={() => {
                  onAddChild(node)
                  onClose()
                }}
              >
                <Plus className="size-4" /> Thêm node con
              </button>
            )}
            <button
              type="button"
              className={item}
              onClick={() => {
                onRemoveFromCanvas(node)
                onClose()
              }}
            >
              <Eraser className="size-4" /> Xóa khỏi Canvas
            </button>
          </>
        )}
      </div>
    </>
  )
}
