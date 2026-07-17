"use client"

import { useEffect, useState } from "react"
import { File, Search, Trash2, Undo2 } from "lucide-react"

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { NotionDoc } from "../types"

interface TrashBoxProps {
  getTrash: () => Promise<NotionDoc[]>
  onRestore: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  children: React.ReactNode
}

/** Trash popover: filter, restore, or permanently delete archived pages. */
export function TrashBox({
  getTrash,
  onRestore,
  onRemove,
  children,
}: TrashBoxProps) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<NotionDoc[] | null>(null)
  const [filter, setFilter] = useState("")
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDocs(null)
    void getTrash().then((result) => {
      if (!cancelled) setDocs(result)
    })
    return () => {
      cancelled = true
    }
  }, [open, getTrash])

  const visible = (docs ?? []).filter((d) =>
    d.title.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton={false}
          render={<span className="block w-full" />}
        >
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-80 gap-2 p-2" align="start" side="top">
          <div className="flex items-center gap-1 px-1">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Lọc theo tiêu đề..."
              className="h-7 border-none bg-transparent px-1 shadow-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {docs === null ? (
              <div className="space-y-2 p-1">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : visible.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">
                Thùng rác trống.
              </p>
            ) : (
              visible.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {doc.icon ? (
                      <span>{doc.icon}</span>
                    ) : (
                      <File className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Khôi phục"
                      onClick={() =>
                        void onRestore(doc.id).then(() =>
                          setDocs((prev) =>
                            prev ? prev.filter((d) => d.id !== doc.id) : prev
                          )
                        )
                      }
                    >
                      <Undo2 />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Xóa vĩnh viễn"
                      onClick={() => setConfirmId(doc.id)}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={confirmId !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa vĩnh viễn?</DialogTitle>
            <DialogDescription>
              Trang và toàn bộ trang con sẽ bị xóa vĩnh viễn. Hành động này
              không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const id = confirmId
                setConfirmId(null)
                if (!id) return
                void onRemove(id).then(() =>
                  setDocs((prev) =>
                    prev ? prev.filter((d) => d.id !== id) : prev
                  )
                )
              }}
            >
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
