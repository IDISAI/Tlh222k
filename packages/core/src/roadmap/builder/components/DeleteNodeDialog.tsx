"use client"

import { useState } from "react"
import { TriangleAlert } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

import type { RoadmapNode } from "../../types"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS } from "../utils/node-type-styles"

interface DeleteNodeDialogProps {
  node: RoadmapNode
  /** Descendants that get cascade-deleted with it. */
  childCount: number
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

/**
 * Permanent-delete confirmation (Req 4.2): names the node and warns that the
 * removal is system-wide and irreversible.
 */
export function DeleteNodeDialog({
  node,
  childCount,
  onCancel,
  onConfirm,
}: DeleteNodeDialogProps) {
  const [busy, setBusy] = useState(false)
  const Icon = NODE_TYPE_ICONS[node.nodeType]

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" /> Xác nhận xóa
            node
          </DialogTitle>
          <DialogDescription>Bạn sắp xóa vĩnh viễn node:</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Icon className={cn("size-4", NODE_TYPE_ACCENT[node.nodeType])} />
          <span className="min-w-0 truncate text-sm font-semibold">
            {node.title}
          </span>
          <Badge variant="secondary">{node.nodeType}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          ⚠ Hành động này sẽ xóa vĩnh viễn node khỏi hệ thống và không thể hoàn
          tác.
          {childCount > 0 && (
            <> {childCount} node con cũng sẽ bị xóa theo.</>
          )}{" "}
          Node sẽ hiển thị dạng mờ trên tất cả các Canvas đang sử dụng nó.
        </p>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm()
              setBusy(false)
            }}
          >
            {busy ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
