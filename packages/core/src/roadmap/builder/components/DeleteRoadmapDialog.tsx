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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import type { Roadmap } from "../../types"

interface DeleteRoadmapDialogProps {
  roadmap: Roadmap
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

/**
 * Roadmap delete confirmation (Req 1.6): shows the roadmap name and requires
 * typing it back before the destructive button activates.
 */
export function DeleteRoadmapDialog({
  roadmap,
  onCancel,
  onConfirm,
}: DeleteRoadmapDialogProps) {
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const matches = confirmation.trim() === roadmap.title

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

        <div className="space-y-1.5">
          <Label htmlFor="confirm-roadmap-name">
            Nhập tên roadmap để xác nhận:
          </Label>
          <Input
            id="confirm-roadmap-name"
            value={confirmation}
            placeholder={roadmap.title}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!matches || busy}
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
