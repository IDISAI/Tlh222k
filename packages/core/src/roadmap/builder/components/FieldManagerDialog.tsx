"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
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
import { toast } from "@workspace/ui/components/sonner"

import { RoadmapService } from "../../api"
import type { CallerRole, Field } from "../../types"
import { serviceErrorMessage } from "../utils/toast-messages"

interface FieldManagerDialogProps {
  role: CallerRole
  onClose: () => void
  /** Fires after any write so the caller can refresh label chips it renders. */
  onChanged?: () => void
}

/**
 * Rename and delete discovery labels.
 *
 * Renaming is a single row update — every block carrying the label follows,
 * which is exactly why labels are a table and not a string column on `Node`.
 * Deleting drops the label everywhere but leaves the blocks intact.
 */
export function FieldManagerDialog({
  role,
  onClose,
  onChanged,
}: FieldManagerDialogProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [fields, setFields] = useState<Field[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  // Deleting a label silently changes what every tab on /roadmaps shows, so it
  // takes a second click rather than a single stray one.
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useMemo(
    () => () =>
      service
        .listFields()
        .then(setFields)
        .catch(() => setFields([])),
    [service]
  )

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = (field: Field) => {
    setEditingId(field.id)
    setDraft(field.name)
    setConfirmId(null)
  }

  const saveEdit = async (field: Field) => {
    const name = draft.trim()
    if (!name || name === field.name) {
      setEditingId(null)
      return
    }
    setBusyId(field.id)
    try {
      await service.updateField(field.id, name, role)
      await load()
      setEditingId(null)
      onChanged?.()
      toast.success(`Đã đổi tên thành "${name}"`)
    } catch (err) {
      toast.error(serviceErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (field: Field) => {
    setBusyId(field.id)
    try {
      await service.deleteField(field.id, role)
      await load()
      setConfirmId(null)
      onChanged?.()
      toast.success(`Đã xóa lĩnh vực "${field.name}"`)
    } catch (err) {
      toast.error(serviceErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quản lý lĩnh vực</DialogTitle>
          <DialogDescription>
            Đổi tên áp dụng cho mọi roadmap đang mang lĩnh vực đó. Xóa chỉ gỡ
            nhãn — roadmap vẫn giữ nguyên.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {fields === null && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Đang tải…
            </p>
          )}
          {fields?.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Chưa có lĩnh vực nào. Tạo từ ô lĩnh vực khi thêm/sửa roadmap.
            </p>
          )}

          {fields?.map((field) => {
            const busy = busyId === field.id
            if (editingId === field.id) {
              return (
                <div key={field.id} className="flex items-center gap-1.5 py-1">
                  <Input
                    autoFocus
                    value={draft}
                    disabled={busy}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void saveEdit(field)
                      }
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label="Lưu tên"
                    onClick={() => void saveEdit(field)}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label="Hủy đổi tên"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )
            }

            return (
              <div
                key={field.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {field.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {confirmId === field.id ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        Xóa?
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void remove(field)}
                      >
                        {busy ? "Đang xóa…" : "Xóa"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmId(null)}
                      >
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Đổi tên ${field.name}`}
                        onClick={() => startEdit(field)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Xóa ${field.name}`}
                        onClick={() => setConfirmId(field.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
