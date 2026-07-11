"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

import {
  MAX_TITLE_LENGTH,
  NODE_TYPES,
  type ArticleType,
  type NodeType,
  type RoadmapNode,
} from "../../types"
import { allowedChildTypes } from "../../utils/validate-hierarchy"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS, nodeTypeLabel } from "../utils/node-type-styles"
import type { CanvasMenuPosition } from "../types"

const PANEL_WIDTH = 340

interface NodeSelectorModalProps {
  /** Cursor position that opened the modal; null = closed (Req 3.1). */
  position: CanvasMenuPosition | null
  /** When creating a child from a parent node, restricts NodeType (Req 2.3). */
  parent: RoadmapNode | null
  onClose: () => void
  /** Resolves true on success → the modal closes. */
  onCreate: (input: {
    nodeType: NodeType
    /** Set only when nodeType = "article" (notion-article-node Req 2.1). */
    articleType?: ArticleType
    title: string
    parentId: string | null
    x: number
    y: number
  }) => Promise<boolean>
}

/**
 * NodeSelector_Modal — appears at the right-click position with the four
 * NodeTypes and a required title (inline error, modal stays open — Req 3.2).
 */
export function NodeSelectorModal({
  position,
  parent,
  onClose,
  onCreate,
}: NodeSelectorModalProps) {
  const allowed = parent ? allowedChildTypes(parent.nodeType) : [...NODE_TYPES]

  const [nodeType, setNodeType] = useState<NodeType>(allowed[0] ?? "role")
  const [articleType, setArticleType] = useState<ArticleType>("notion")
  const [title, setTitle] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Fresh form every time the modal (re)opens somewhere else.
  useEffect(() => {
    setTitle("")
    setError("")
    setNodeType(allowed[0] ?? "role")
    setArticleType("notion")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open/parent change
  }, [position, parent])

  if (!position) return null

  const left = Math.max(
    8,
    Math.min(position.screenX, window.innerWidth - PANEL_WIDTH - 8)
  )
  const top = Math.max(8, Math.min(position.screenY, window.innerHeight - 320))

  const handleSubmit = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setError("Tiêu đề không được để trống")
      return
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      setError(`Tiêu đề tối đa ${MAX_TITLE_LENGTH} ký tự`)
      return
    }
    setSubmitting(true)
    const ok = await onCreate({
      nodeType,
      articleType: nodeType === "article" ? articleType : undefined,
      title: trimmed,
      parentId: parent?.id ?? null,
      x: position.flowX,
      y: position.flowY,
    })
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Tạo node mới"
        className="fixed z-50 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        style={{ left, top, width: PANEL_WIDTH }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose()
          if (e.key === "Enter") void handleSubmit()
        }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tạo node mới</h3>
            {parent && (
              <span className="text-xs text-muted-foreground">
                con của “{parent.title}”
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="node-title">Tiêu đề *</Label>
            <Input
              id="node-title"
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder="Nhập tiêu đề node..."
              onChange={(e) => {
                setTitle(e.target.value)
                if (error) setError("")
              }}
            />
            <div className="flex justify-between text-xs">
              {/* Inline error keeps the modal open (Req 3.2). */}
              <span className="text-destructive">{error}</span>
              <span className="text-muted-foreground">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Chọn loại node</Label>
            <div className="grid grid-cols-2 gap-2">
              {NODE_TYPES.map((type) => {
                const Icon = NODE_TYPE_ICONS[type]
                const isAllowed = allowed.includes(type)
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={nodeType === type ? "default" : "outline"}
                    disabled={!isAllowed}
                    title={
                      isAllowed
                        ? undefined
                        : parent
                          ? `Node cha là \`${parent.nodeType}\` — chỉ tạo được node cấp ${allowed.map(nodeTypeLabel).join(", ")}`
                          : undefined
                    }
                    onClick={() => setNodeType(type)}
                  >
                    <Icon
                      className={cn(
                        "size-3.5",
                        nodeType !== type && NODE_TYPE_ACCENT[type]
                      )}
                    />
                    {nodeTypeLabel(type)}
                  </Button>
                )
              })}
            </div>
          </div>

          {nodeType === "article" && (
            <div className="space-y-1.5">
              <Label>Loại tài liệu</Label>
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
              {articleType === "notion" && (
                <p className="text-xs text-muted-foreground">
                  Trang Notion sẽ được tạo tự động và mở ngay sau khi tạo node.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Đang tạo..." : "Tạo node"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
