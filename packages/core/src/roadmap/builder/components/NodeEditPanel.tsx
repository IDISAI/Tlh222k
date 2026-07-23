"use client"

import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type ArticleType,
  type RoadmapNode,
  type UpdateNodeInput,
} from "../../types"
import { FieldPicker } from "./FieldPicker"

interface NodeEditPanelProps {
  node: RoadmapNode
  onClose: () => void
  /** Optimistic update + async mutation live in the caller (Req 9.4/9.5). */
  onSave: (id: string, input: UpdateNodeInput) => Promise<boolean>
  /**
   * @deprecated Publish is owned by the content editor (Notion DocumentView /
   * Jupyter EditorToolbar), same pattern as notebooks. Kept optional so older
   * call sites still typecheck; never invoked here.
   */
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
}

/**
 * Edit panel (Req 9): title (required, ≤150), description (≤500), read-only
 * NodeType badge, and — for articles — articleType only.
 *
 * Links are INTERNAL (no Notion Page ID / Jupyter URL form fields):
 * - notion → Document auto-created on node create; open via Điều hướng
 * - jupyter → notebook at /notebooks/[slug] (or /learn on web)
 *
 * Publish lives in the content editor (DocumentView / EditorToolbar), not here.
 */
export function NodeEditPanel({ node, onClose, onSave }: NodeEditPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [description, setDescription] = useState(node.description ?? "")
  const [articleType, setArticleType] = useState<ArticleType | null>(
    node.articleType
  )
  const [fieldIds, setFieldIds] = useState<string[]>(
    () => node.fields?.map((f) => f.id) ?? []
  )
  const [titleError, setTitleError] = useState("")
  const [saving, setSaving] = useState(false)

  const isArticle = node.nodeType === "article"

  const handleSave = async () => {
    // Req 9.3: empty/whitespace title → inline error, no save.
    if (!title.trim()) {
      setTitleError("Tiêu đề không được để trống")
      return
    }

    if (isArticle && !articleType) {
      toast.error("Vui lòng chọn loại tài liệu (Notion hoặc Jupyter)")
      return
    }

    const input: UpdateNodeInput = {
      title: title.trim(),
      description: description.trim(),
    }
    // Articles never carry discovery labels (they don't reach the public card
    // grid), so only send the key for block nodes. Omitting it entirely leaves
    // whatever the server has untouched.
    if (!isArticle) input.fieldIds = fieldIds
    if (isArticle && articleType) {
      input.articleType = articleType
      // Jupyter is always internal by slug — never persist an external URL.
      if (articleType === "jupyter") input.jupyterUrl = ""
    }

    setSaving(true)
    const ok = await onSave(node.id, input)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Sheet
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[400px]">
        <SheetHeader className="border-b">
          <SheetTitle>Chỉnh sửa node</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <Label>Loại node (không thể thay đổi)</Label>
            <div>
              <Badge variant="secondary">{node.nodeType}</Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Tiêu đề *</Label>
            <Input
              id="edit-title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value)
                if (titleError) setTitleError("")
              }}
            />
            <div className="flex justify-between text-xs">
              <span className="text-destructive">{titleError}</span>
              <span className="text-muted-foreground">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Mô tả (tùy chọn)</Label>
            <Textarea
              id="edit-description"
              rows={4}
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>

          {!isArticle && (
            <div className="space-y-1.5">
              <Label>Lĩnh vực (tùy chọn)</Label>
              <FieldPicker
                value={fieldIds}
                onChange={setFieldIds}
                disabled={saving}
              />
            </div>
          )}

          {isArticle && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label>Loại tài liệu *</Label>
                <div className="flex gap-2">
                  {(["notion", "jupyter"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={articleType === type ? "default" : "outline"}
                      onClick={() => setArticleType(type)}
                    >
                      {type === "notion" ? "Notion" : "Jupyter"}
                    </Button>
                  ))}
                </div>
              </div>

              {articleType === "notion" && (
                <p className="text-xs text-muted-foreground">
                  Nội dung + xuất bản chỉnh trong trang Notion (nút Điều hướng).
                  Không cần Notion Page ID — trang tự tạo khi tạo bài viết.
                </p>
              )}

              {articleType === "jupyter" && (
                <p className="text-xs text-muted-foreground">
                  Notebook nội bộ tại{" "}
                  <code className="rounded bg-muted px-1">
                    /notebooks/{node.slug}
                  </code>
                  . Xuất bản trong editor notebook (cùng pattern Jupyter
                  Toolbar), không cần Jupyter URL.
                </p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
