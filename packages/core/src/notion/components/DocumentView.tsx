"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, Copy, Globe, ImageIcon, Loader2, Smile, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import type { NotionActions, NotionDoc } from "../types"
import { useDebouncedCallback } from "../hooks/use-debounced-callback"
import { Editor } from "./Editor"
import { IconPicker } from "./IconPicker"

interface DocumentViewProps {
  doc: NotionDoc | null
  loading: boolean
  canEdit: boolean
  actions: NotionActions
  /** Public web URL of the workspace root (copy target after publish). */
  publicUrl: string | null
  /** Selected doc changed on the server; `treeAffecting` re-syncs the sidebar. */
  onDocChanged: (doc: NotionDoc, treeAffecting: boolean) => void
  /**
   * Title ↔ linked roadmap node are ONE title (QĐ-2, reverse of the builder's
   * node→notion sync). Fired after a title save with the doc's slug so the
   * caller can push it to the node with the same slug. Best-effort.
   */
  onTitleSync?: (slug: string, title: string) => void | Promise<void>
  /** Slot for the "open sidebar" hamburger when the sidebar is collapsed. */
  topLeft?: ReactNode
}

/** Main column: cover, icon, title, publish menu, BlockNote content. */
export function DocumentView({
  doc,
  loading,
  canEdit,
  actions,
  publicUrl,
  onDocChanged,
  onTitleSync,
  topLeft,
}: DocumentViewProps) {
  const [title, setTitle] = useState(doc?.title ?? "")
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const docId = doc?.id

  // Re-seed local title when switching documents (not on every autosave echo).
  useEffect(() => {
    setTitle(doc?.title ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  const saveTitle = useDebouncedCallback((id: string, value: string) => {
    void actions
      .update?.({ id, title: value || "Untitled" })
      .then((updated) => {
        onDocChanged(updated, true)
        // Push the rename to the linked roadmap node (same slug).
        if (updated.slug) void onTitleSync?.(updated.slug, updated.title)
      })
  }, 500)

  const saveContent = useDebouncedCallback((id: string, content: string) => {
    void actions
      .update?.({ id, content })
      .then((updated) => onDocChanged(updated, false))
  }, 700)

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 pt-16 md:px-14">
        <Skeleton className="size-14 rounded-md" />
        <Skeleton className="h-10 w-3/5" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 p-2">{topLeft}</div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Trang này chưa được xuất bản hoặc không tồn tại.
          </p>
        </div>
      </div>
    )
  }

  const pickCover = () => coverInputRef.current?.click()

  const handleCoverFile = async (file: File | undefined) => {
    if (!file || !actions.uploadFile || !actions.update) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const { url } = await actions.uploadFile(form)
      const updated = await actions.update({ id: doc.id, coverImage: url })
      onDocChanged(updated, false)
    } catch {
      toast.error("Tải ảnh bìa thất bại.")
    } finally {
      setUploading(false)
      if (coverInputRef.current) coverInputRef.current.value = ""
    }
  }

  const copyPublicUrl = () => {
    if (!publicUrl) return
    void navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      toast.success("Đã sao chép liên kết công khai.")
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex min-w-0 items-center gap-2">
          {topLeft}
          <span className="truncate text-sm font-medium">
            {doc.icon ? `${doc.icon} ` : ""}
            {doc.title}
          </span>
        </div>
        {canEdit && (
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm">
                  {doc.isPublished ? (
                    <>
                      <Globe className="size-4 text-sky-500" />
                      <span className="text-sky-500">Đã xuất bản</span>
                    </>
                  ) : (
                    "Xuất bản"
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80" align="end">
              {doc.isPublished ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-sky-500">
                    <Globe className="size-3.5" />
                    Trang này đang công khai trên web.
                  </p>
                  {publicUrl && (
                    <div className="flex items-center">
                      <input
                        readOnly
                        value={publicUrl}
                        className="h-8 flex-1 truncate rounded-l-md border bg-muted px-2 text-xs outline-none"
                      />
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="rounded-l-none"
                        onClick={copyPublicUrl}
                      >
                        {copied ? <Check /> : <Copy />}
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      void actions
                        .update?.({ id: doc.id, isPublished: false })
                        .then((updated) => onDocChanged(updated, false))
                    }
                  >
                    Hủy xuất bản
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <Globe className="mx-auto size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Xuất bản trang này</p>
                  <p className="text-xs text-muted-foreground">
                    Khách truy cập web sẽ xem được nội dung (chỉ đọc).
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      void actions
                        .update?.({ id: doc.id, isPublished: true })
                        .then((updated) => onDocChanged(updated, false))
                    }
                  >
                    Xuất bản
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-40">
        {/* Cover image */}
        {doc.coverImage && (
          <div className="group relative h-[30vh] w-full">
            <img
              src={doc.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
            {canEdit && (
              <div className="absolute right-4 bottom-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={uploading}
                  onClick={pickCover}
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ImageIcon />
                  )}
                  Đổi ảnh
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    void actions
                      .removeCoverImage?.(doc.id)
                      .then((updated) => onDocChanged(updated, false))
                  }
                >
                  <X /> Xóa
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Icon + title */}
        <div
          className={cn(
            "group mx-auto max-w-3xl px-6 md:px-14",
            doc.coverImage ? "pt-6" : "pt-12"
          )}
        >
          {doc.icon &&
            (canEdit ? (
              <IconPicker
                onSelect={(emoji) =>
                  void actions
                    .update?.({ id: doc.id, icon: emoji })
                    .then((updated) => onDocChanged(updated, true))
                }
                onRemove={() =>
                  void actions
                    .removeIcon?.(doc.id)
                    .then((updated) => onDocChanged(updated, true))
                }
              >
                <button
                  type="button"
                  className="rounded-md text-6xl transition-opacity hover:opacity-75"
                >
                  {doc.icon}
                </button>
              </IconPicker>
            ) : (
              <p className="text-6xl">{doc.icon}</p>
            ))}

          {canEdit && (
            <div className="flex items-center gap-1 py-3 opacity-0 transition-opacity group-hover:opacity-100">
              {!doc.icon && (
                <IconPicker
                  onSelect={(emoji) =>
                    void actions
                      .update?.({ id: doc.id, icon: emoji })
                      .then((updated) => onDocChanged(updated, true))
                  }
                >
                  <Button variant="ghost" size="xs">
                    <Smile /> Thêm icon
                  </Button>
                </IconPicker>
              )}
              {!doc.coverImage && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={uploading}
                  onClick={pickCover}
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ImageIcon />
                  )}
                  Thêm ảnh bìa
                </Button>
              )}
            </div>
          )}

          {canEdit ? (
            <textarea
              rows={1}
              value={title}
              placeholder="Untitled"
              onChange={(e) => {
                setTitle(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = `${e.target.scrollHeight}px`
                saveTitle(doc.id, e.target.value.trim())
              }}
              className="w-full resize-none bg-transparent pb-3 text-4xl font-bold text-foreground outline-none wrap-break-word placeholder:text-muted-foreground/40"
            />
          ) : (
            <h1 className="pb-3 text-4xl font-bold wrap-break-word">
              {doc.title}
            </h1>
          )}
        </div>

        {/* Content */}
        <div className="mx-auto max-w-3xl">
          <Editor
            key={doc.id}
            initialContent={doc.content}
            editable={canEdit}
            onChange={
              canEdit ? (content) => saveContent(doc.id, content) : undefined
            }
            uploadFile={canEdit ? actions.uploadFile : undefined}
          />
        </div>

        {canEdit && (
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleCoverFile(e.target.files?.[0])}
          />
        )}
      </div>
    </div>
  )
}
