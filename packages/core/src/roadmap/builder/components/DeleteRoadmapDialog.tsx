"use client"

import { useState } from "react"
import { TriangleAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { Roadmap } from "../../types"

interface DeleteRoadmapDialogProps {
  roadmap: Roadmap
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

/**
 * Roadmap delete confirmation (Req 1.6): shows the roadmap name.
 */
export function DeleteRoadmapDialog({
  roadmap,
  onCancel,
  onConfirm,
}: DeleteRoadmapDialogProps) {
  const [busy, setBusy] = useState(false)

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
            roadmap
          </DialogTitle>
          <DialogDescription>
            Bạn sắp xóa roadmap “{roadmap.title}”. Hành động này sẽ xóa toàn bộ
            roadmap và không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

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
            {busy ? "Đang xóa..." : "Xóa roadmap"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
