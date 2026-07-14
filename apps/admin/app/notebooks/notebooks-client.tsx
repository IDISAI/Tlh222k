"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Globe, Plus, Trash2 } from "lucide-react"

import { HttpNotebookStore, type NotebookSummary } from "@workspace/core"
import { slugify } from "@workspace/core/notebook/utils/slugify"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

const KERNEL_SERVER_URL = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL

/** List/create/delete notebooks stored on kernel-server. */
export function NotebooksIndexClient() {
  const { getToken } = useAuth()
  const router = useRouter()
  const store = useMemo(
    () =>
      KERNEL_SERVER_URL ? new HttpNotebookStore(KERNEL_SERVER_URL, getToken) : null,
    [getToken]
  )
  const [notebooks, setNotebooks] = useState<NotebookSummary[] | null>(null)
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!store) return
    store
      .list()
      .then(setNotebooks)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Không tải được danh sách")
      )
  }, [store])

  useEffect(refresh, [refresh])

  if (!KERNEL_SERVER_URL) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Chưa cấu hình NEXT_PUBLIC_KERNEL_SERVER_URL — danh sách notebook cần
        kernel-server.
      </p>
    )
  }

  const slug = slugify(title)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Notebooks</h1>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (slug) router.push(`/notebooks/${slug}`)
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên notebook mới (vd: Intro to NumPy)"
        />
        <Button type="submit" disabled={!slug}>
          <Plus className="size-4" /> Tạo
        </Button>
      </form>
      {slug && (
        <p className="-mt-4 text-xs text-muted-foreground">
          Đường dẫn: /notebooks/{slug}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {notebooks === null ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : notebooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có notebook nào — tạo notebook đầu tiên ở trên.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {notebooks.map((notebook) => (
            <li
              key={notebook.slug}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/notebooks/${notebook.slug}`}
                  className="font-medium hover:underline"
                >
                  {notebook.title || notebook.slug}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {notebook.slug} · cập nhật{" "}
                  {new Date(notebook.updatedAt).toLocaleString("vi-VN")}
                </p>
              </div>
              {notebook.published && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  <Globe className="size-3" /> Đã xuất bản
                </span>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title="Xóa notebook"
                aria-label={`Xóa ${notebook.slug}`}
                onClick={() => {
                  if (!confirm(`Xóa notebook "${notebook.title || notebook.slug}"?`))
                    return
                  store
                    ?.remove(notebook.slug)
                    .then(refresh)
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error ? cause.message : "Xóa thất bại"
                      )
                    )
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
