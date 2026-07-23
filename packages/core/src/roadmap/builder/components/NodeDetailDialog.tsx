"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  FileText,
  PencilLine,
  Plus,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import type { ArticleType, RoadmapNode } from "../../types"
import { ancestorPath } from "../../utils/node-ancestors"
import {
  navigationBlockedMessage,
  nodeNavigationUrl,
} from "../../utils/node-navigation"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS } from "../utils/node-type-styles"
import { childrenOf } from "./builder-context"

interface ArticleCreateFormProps {
  chapterId: string
  onCreateArticle: (input: {
    chapterId: string
    title: string
    articleType: ArticleType
  }) => Promise<RoadmapNode | null>
  onDone: () => void
}

function ArticleCreateForm({
  chapterId,
  onCreateArticle,
  onDone,
}: ArticleCreateFormProps) {
  const [title, setTitle] = useState("")
  const [articleType, setArticleType] = useState<ArticleType>("notion")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const result = await onCreateArticle({
      chapterId,
      title: title.trim(),
      articleType,
    })
    setSaving(false)
    if (result) {
      setTitle("")
      onDone()
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-md border p-3"
    >
      <p className="text-xs font-medium">Bài viết mới</p>
      <div className="space-y-1">
        <Label className="text-xs">Tiêu đề *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên bài viết"
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Loại</Label>
        <Select
          value={articleType}
          onValueChange={(v) => setArticleType(v as ArticleType)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="notion">Notion</SelectItem>
            <SelectItem value="jupyter">Jupyter Notebook</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {articleType === "notion" ? (
        <p className="text-xs text-muted-foreground">
          Trang Notion sẽ được tạo tự động và mở ngay sau khi tạo bài viết.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Notebook nội bộ — điều hướng tới{" "}
          <code className="text-[11px]">/notebooks/[slug]</code> (slug sinh từ
          tiêu đề). Không cần Jupyter URL.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={saving || !title.trim()}
          className="h-7 text-xs"
        >
          Tạo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onDone}
        >
          Hủy
        </Button>
      </div>
    </form>
  )
}

interface NodeDetailDialogProps {
  node: RoadmapNode | null
  nodes: RoadmapNode[]
  onClose: () => void
  /** Omitted / ignored in read-only (viewer) mode. */
  onEdit?: (node: RoadmapNode) => void
  /** Viewer mode: hide the edit action, keep only "Điều hướng". */
  readOnly?: boolean
  /**
   * Base path for INTERNAL Jupyter articles. Web (viewers) → "/learn"
   * (read-only viewer); admin/super-admin (creators) → "/notebooks" (editor).
   */
  notebookBasePath?: string
  /**
   * Base path for INTERNAL Notion articles. Both zones route to "/notion" —
   * web renders the read-only workspace, admin the editor (admin may pass a
   * zone-prefixed path in production).
   */
  notionBasePath?: string
  /**
   * Admin-builder base ("/roadmaps"). When set, a role/skill/chapter block
   * navigates to its OWN composition canvas (`{base}/{id}`); omitted in viewer
   * zones → `/roadmap/{slug}` as before.
   */
  builderBasePath?: string
  /**
   * Hide "Điều hướng" when this node IS the roadmap whose detail page we're on
   * (LEGO model: you can't drill into the canvas you're already looking at).
   */
  hideNavigate?: boolean
  /** If provided, chapter nodes show a "+ Tạo bài viết" button. */
  onCreateArticle?: (input: {
    chapterId: string
    title: string
    articleType: ArticleType
  }) => Promise<RoadmapNode | null>
}

/**
 * NodeDetail panel — full node info shown as a right-side slide-in sidebar (not
 * a centered dialog) on double-click, with the three actions Chỉnh sửa / Xóa /
 * Điều hướng (Req 7). Matches the viewer's right-drawer pattern so the builder
 * and the viewer feel like one product.
 */
export function NodeDetailDialog({
  node,
  nodes,
  onClose,
  onEdit,
  readOnly = false,
  notebookBasePath = "/notebooks",
  notionBasePath = "/notion",
  builderBasePath,
  hideNavigate = false,
  onCreateArticle,
}: NodeDetailDialogProps) {
  const [showArticleForm, setShowArticleForm] = useState(false)
  if (!node) return null

  const Icon = NODE_TYPE_ICONS[node.nodeType]
  const parent = node.parentId
    ? (nodes.find((n) => n.id === node.parentId) ?? null)
    : null
  const childCount = childrenOf(nodes, node.id).length
  // Where this node sits: role › skill › chapter › article.
  const trail = ancestorPath(nodes, node)
  const navUrl = nodeNavigationUrl(node, {
    notebookBasePath,
    notionBasePath,
    parentChapterSlug: parent?.nodeType === "chapter" ? parent.slug : undefined,
    builderBasePath,
  })
  const isArticle = node.nodeType === "article"
  // LEGO: articles are never canvas blocks — a chapter shows its articles here
  // in the right panel instead (canvas không chứa article).
  const chapterArticles =
    node.nodeType === "chapter"
      ? nodes.filter(
          (n) =>
            n.parentId === node.id && n.nodeType === "article" && !n.isDeleted
        )
      : []
  const canNavigate = navUrl !== null
  // Same-origin routes (role/skill, internal notebook/notion) stay in this
  // zone; only absolute URLs (legacy external docs) open in a new tab.
  const isExternal = navUrl !== null && /^https?:\/\//.test(navUrl)

  const handleNavigate = () => {
    // Unlinked nodes warn instead of navigating (Req 1.3 / 10.6 / 11.6).
    if (!navUrl) {
      toast.warning(navigationBlockedMessage(node))
      return
    }
    if (isExternal) {
      window.open(navUrl, "_blank", "noopener,noreferrer")
    } else {
      window.location.assign(navUrl)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        showOverlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b dark:border-zinc-800">
          <SheetTitle className="flex items-center gap-2">
            <Icon className={cn("size-4", NODE_TYPE_ACCENT[node.nodeType])} />
            <span className="min-w-0 truncate">{node.title}</span>
            <Badge variant="secondary">{node.nodeType}</Badge>
            {isArticle && node.articleType && (
              <Badge variant="outline">{node.articleType}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
          {node.description && (
            <div className="space-y-1">
              <Label>Mô tả</Label>
              <p className="text-muted-foreground">{node.description}</p>
            </div>
          )}

          {!isArticle && (node.fields?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <Label>Lĩnh vực</Label>
              {/* Read-only on purpose: this panel describes a node, it does not
                  navigate. Making the chips clickable would need a destination
                  decided first (filter the canvas? jump to /roadmaps?). */}
              <div className="flex flex-wrap gap-1.5">
                {node.fields?.map((field) => (
                  <span
                    key={field.id}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
                  >
                    {field.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isArticle && (
            <div className="space-y-1">
              <Label>Tài liệu</Label>
              {navUrl ? (
                <a
                  href={navUrl}
                  {...(isExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="block truncate text-xs text-primary underline underline-offset-2"
                >
                  {navUrl}
                </a>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" /> Chưa được liên kết
                </p>
              )}
            </div>
          )}

          {node.nodeType === "chapter" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Bài viết ({chapterArticles.length})</Label>
                {onCreateArticle && !showArticleForm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => setShowArticleForm(true)}
                  >
                    <Plus className="size-3" /> Tạo
                  </Button>
                )}
              </div>
              {showArticleForm && onCreateArticle && (
                <ArticleCreateForm
                  chapterId={node.id}
                  onCreateArticle={onCreateArticle}
                  onDone={() => setShowArticleForm(false)}
                />
              )}
              {chapterArticles.length === 0 && !showArticleForm ? (
                <p className="text-xs text-muted-foreground italic">
                  Chưa có bài viết nào trong chapter này
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {chapterArticles.map((a) => {
                    const url = nodeNavigationUrl(a, {
                      notebookBasePath,
                      notionBasePath,
                      parentChapterSlug: node.slug,
                    })
                    const cardContent = (
                      <Card
                        size="sm"
                        className="cursor-pointer transition-all hover:bg-muted hover:shadow-sm"
                      >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <CardTitle className="truncate text-xs font-semibold">
                              {a.title}
                            </CardTitle>
                          </div>
                          {a.isPublished ? (
                            <Badge
                              variant="secondary"
                              className="h-5 border-transparent bg-emerald-100 px-1.5 py-0 text-[10px] text-emerald-700 hover:bg-emerald-100"
                            >
                              Public
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 py-0 text-[10px] text-muted-foreground"
                            >
                              Draft
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="flex items-center gap-2 p-3 pt-0">
                          {a.articleType === "notion" ? (
                            <Badge
                              variant="outline"
                              className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-500"
                            >
                              Notion
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-orange-200 bg-orange-50 text-[10px] text-orange-600"
                            >
                              Jupyter
                            </Badge>
                          )}
                          {!url && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-200 bg-amber-50 text-[10px] text-amber-600"
                            >
                              <AlertTriangle className="size-3" /> Chưa liên kết
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    )

                    return (
                      <div key={a.id}>
                        {url ? (
                          <a href={url} className="block no-underline">
                            {cardContent}
                          </a>
                        ) : (
                          <div
                            onClick={() => {
                              toast.warning(navigationBlockedMessage(a))
                            }}
                          >
                            {cardContent}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Full trail, so an article says which chapter it lives in and
              which roadmap that chapter belongs to. */}
          <div className="space-y-1.5">
            <Label>Vị trí</Label>
            <nav
              aria-label="Vị trí trong roadmap"
              className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs"
            >
              {trail.map((step, index) => {
                const current = index === trail.length - 1
                return (
                  <span key={step.id} className="flex items-center gap-1">
                    {index > 0 && (
                      <ChevronRight
                        aria-hidden
                        className="size-3 text-muted-foreground"
                      />
                    )}
                    <span className="text-muted-foreground">
                      {step.nodeType}
                    </span>
                    <span
                      className={cn(
                        "font-medium",
                        current ? "text-foreground" : "text-foreground/80"
                      )}
                    >
                      {step.title}
                    </span>
                  </span>
                )
              })}
            </nav>
            {trail.length === 1 && (
              <p className="text-xs text-muted-foreground">
                Node này chưa nằm trong roadmap nào.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <p>
              Node cha:{" "}
              <span className="font-medium text-foreground">
                {parent ? parent.title : "—"}
              </span>
            </p>
            <p>
              Node con:{" "}
              <span className="font-medium text-foreground">{childCount}</span>
            </p>
          </div>
        </div>

        <SheetFooter className="border-t dark:border-zinc-800">
          {!hideNavigate && (
            <Button
              type="button"
              // Req 1.3/10.6/11.6: stays clickable so the toast can explain WHY
              // navigation is blocked; the muted style signals "disabled".
              className={cn(!canNavigate && "opacity-50")}
              aria-disabled={!canNavigate}
              title={!navUrl ? navigationBlockedMessage(node) : undefined}
              onClick={handleNavigate}
            >
              <ExternalLink className="size-4" /> Điều hướng
            </Button>
          )}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose()
                onEdit?.(node)
              }}
            >
              <PencilLine className="size-4" /> Chỉnh sửa
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
