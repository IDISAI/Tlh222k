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
import { isValidUrl } from "../../utils/is-valid-url"

interface NodeEditPanelProps {
  node: RoadmapNode
  onClose: () => void
  /** Optimistic update + async mutation live in the caller (Req 9.4/9.5). */
  onSave: (id: string, input: UpdateNodeInput) => Promise<boolean>
}

/**
 * Edit panel (Req 9): title (required, ≤150), description (≤500), read-only
 * NodeType badge, and — for articles — articleType with its required link.
 */
export function NodeEditPanel({ node, onClose, onSave }: NodeEditPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [description, setDescription] = useState(node.description ?? "")
  const [articleType, setArticleType] = useState<ArticleType | null>(
    node.articleType
  )
  const [jupyterUrl, setJupyterUrl] = useState(node.jupyterUrl ?? "")
  const [titleError, setTitleError] = useState("")
  const [saving, setSaving] = useState(false)

  const isArticle = node.nodeType === "article"

  const handleSave = async () => {
    // Req 9.3: empty/whitespace title → inline error, no save.
    if (!title.trim()) {
      setTitleError("Tiêu đề không được để trống")
      return
    }

    if (isArticle) {
      // Req 9.2/9.6: article link fields are required per articleType.
      if (!articleType) {
        toast.error("Vui lòng chọn loại tài liệu (Notion hoặc Jupyter)")
        return
      }
      if (articleType === "jupyter") {
        if (!jupyterUrl.trim()) {
          toast.error("Jupyter URL là bắt buộc khi chọn loại Jupyter")
          return
        }
        if (!isValidUrl(jupyterUrl.trim())) {
          toast.error("Jupyter URL không hợp lệ")
          return
        }
      }
    }

    const input: UpdateNodeInput = {
      title: title.trim(),
      description: description.trim(),
    }
    if (isArticle && articleType) {
      input.articleType = articleType
      input.jupyterUrl = articleType === "jupyter" ? jupyterUrl.trim() : ""
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
                  Nội dung Notion được chỉnh sửa trực tiếp trong trang tài liệu
                  (mở qua "Điều hướng").
                </p>
              )}

              {articleType === "jupyter" && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-jupyter">Jupyter URL *</Label>
                  <Input
                    id="edit-jupyter"
                    type="url"
                    value={jupyterUrl}
                    placeholder="https://..."
                    onChange={(e) => setJupyterUrl(e.target.value)}
                  />
                </div>
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
