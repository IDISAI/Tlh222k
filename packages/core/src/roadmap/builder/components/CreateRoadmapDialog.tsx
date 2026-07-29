"use client"

import { useMemo, useState } from "react"
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
import { RequiredMark } from "@workspace/ui/components/required-mark"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { cn } from "@workspace/ui/lib/utils"

import { RoadmapService } from "../../api"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type CallerRole,
  type Level,
  type RoadmapNode,
  type Visibility,
} from "../../types"
import { serviceErrorMessage } from "../utils/toast-messages"
import { CoverUploadField } from "./CoverUploadField"
import { FieldPicker } from "./FieldPicker"

/** A roadmap is a role or a skill (a role/skill node IS a roadmap block). */
const ROADMAP_KINDS = [
  { value: "role" as const, label: "Lộ trình" },
  { value: "skill" as const, label: "Kỹ năng" },
]

function createSlugPreview(title: string) {
  const slug = title
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug ? `/roadmaps/${slug}` : "/roadmaps/..."
}

interface CreateRoadmapDialogProps {
  role: CallerRole
  onClose: () => void
  onCreated: (node: RoadmapNode) => void
  /** Validates and persists a roadmap block's cover image, returning its URL. */
  uploadCover: (file: File) => Promise<string>
}

/** "+ Tạo roadmap mới" (Req 1.1) — creates an unpublished draft. */
export function CreateRoadmapDialog({
  role,
  onClose,
  onCreated,
  uploadCover,
}: CreateRoadmapDialogProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [nodeType, setNodeType] = useState<"role" | "skill">("role")
  const [fieldIds, setFieldIds] = useState<string[]>([])
  const [level, setLevel] = useState<Level | "">("")
  const [visibility, setVisibility] = useState<Visibility>("FREE")
  const [coverUrl, setCoverUrl] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const handleTitle = (value: string) => {
    setTitle(value)
    if (error) setError("")
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Tên roadmap không được để trống")
      return
    }
    setBusy(true)
    try {
      // A roadmap IS a role/skill block (LEGO): one standalone node that owns
      // itself. No container roadmap, no separate root node — createBlock adds
      // it to the store so it lists in both the table and the Kho sidebar.
      const node = await service.createBlock(
        {
          nodeType,
          title: title.trim(),
          description: description.trim() || undefined,
          positionX: 0,
          positionY: 0,
          fieldIds,
          level: level || null,
          visibility,
          coverUrl: coverUrl.trim() || null,
          tags: tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        role
      )
      toast.success("Đã tạo roadmap mới")
      onCreated(node)
    } catch (err) {
      toast.error(serviceErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border/80 bg-background p-0 sm:max-w-[540px]">
        <DialogHeader>
          <div className="border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-2xl">Tạo roadmap</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm">
              Bản nháp được lưu tự động, xuất bản khi bạn sẵn sàng.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-2">
          <div className="space-y-1.5">
            <Label htmlFor="rm-title">Tiêu đề<RequiredMark /></Label>
            <Input
              id="rm-title"
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              aria-required="true"
              placeholder="vd: Lộ trình Frontend 2026"
              onChange={(e) => handleTitle(e.target.value)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-slug">Slug</Label>
            <Input
              id="rm-slug"
              value={createSlugPreview(title)}
              readOnly
              aria-label="Slug được tạo từ tiêu đề"
              className="bg-muted font-mono text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-description">Mô tả ngắn</Label>
            <Textarea
              id="rm-description"
              rows={3}
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="Một hoặc hai câu hiển thị trên thẻ và trang chi tiết"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Loại</Label>
            <div className="flex gap-2">
              {ROADMAP_KINDS.map((kind) => (
                <Button
                  key={kind.value}
                  type="button"
                  variant={nodeType === kind.value ? "default" : "outline"}
                  size="sm"
                  className={cn("flex-1")}
                  onClick={() => setNodeType(kind.value)}
                >
                  {kind.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Lĩnh vực</Label>
            <FieldPicker
              role={role}
              value={fieldIds}
              onChange={setFieldIds}
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5"><Label htmlFor="rm-level">Cấp độ</Label><select id="rm-level" value={level} onChange={(event) => setLevel(event.target.value as Level | "")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Chưa chọn</option><option value="BASIC">Cơ bản</option><option value="INTERMEDIATE">Trung cấp</option><option value="ADVANCED">Nâng cao</option></select></label>
            <label className="space-y-1.5"><Label htmlFor="rm-visibility">Quyền xem</Label><select id="rm-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="FREE">Miễn phí</option><option value="INTERNAL">Nội bộ AIO</option></select></label>
          </div>

          <div className="space-y-1.5">
            <Label>Người phụ trách</Label>
            {/* No picker: the person in charge is whoever creates the block,
                stamped server-side from the auth context. Nothing to choose. */}
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Bạn — người tạo roadmap này
            </p>
          </div>

          <CoverUploadField
            id="rm-cover"
            label="Ảnh bìa"
            imageUrl={coverUrl || null}
            aspectClassName="aspect-video"
            placeholderHint="Bấm để chọn ảnh JPG, PNG hoặc WebP"
            helpText="Dưới 3 MB. Ảnh sẽ tự crop cho vừa khung khi hiển thị."
            disabled={busy}
            accept="image/jpeg,image/webp,image/png"
            upload={uploadCover}
            onUploaded={setCoverUrl}
          />

          <div className="space-y-1.5">
            <Label htmlFor="rm-tags">Thẻ</Label>
            <Input
              id="rm-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="frontend, web, scripting"
            />
            <p className="text-xs text-muted-foreground">Cách nhau bằng dấu phẩy.</p>
          </div>

          <p className="text-xs text-muted-foreground">
            Roadmap được tạo ở trạng thái bản nháp. Bạn có thể chỉnh sửa node
            và xuất bản từ workspace.
          </p>
        </div>

        <DialogFooter className="border-t bg-background px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={busy || !title.trim()} onClick={() => void handleCreate()}>
            {busy ? "Đang tạo..." : "Tạo bản nháp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
