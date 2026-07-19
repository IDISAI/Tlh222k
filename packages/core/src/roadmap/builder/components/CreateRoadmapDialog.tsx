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
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { cn } from "@workspace/ui/lib/utils"

import { RoadmapService } from "../../api"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type CallerRole,
  type Roadmap,
} from "../../types"
import { slugify } from "../../utils/slugify"
import { serviceErrorMessage } from "../utils/toast-messages"

/** A roadmap is a role or a skill (a role/skill node IS a roadmap). */
const ROADMAP_KINDS = [
  { value: "role" as const, label: "Role" },
  { value: "skill" as const, label: "Skill" },
]

interface CreateRoadmapDialogProps {
  role: CallerRole
  onClose: () => void
  onCreated: (roadmap: Roadmap) => void
}

/** "+ Tạo roadmap mới" (Req 1.1) — creates an unpublished draft. */
export function CreateRoadmapDialog({
  role,
  onClose,
  onCreated,
}: CreateRoadmapDialogProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [nodeType, setNodeType] = useState<"role" | "skill">("role")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const handleTitle = (value: string) => {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
    if (error) setError("")
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Tên roadmap không được để trống")
      return
    }
    setBusy(true)
    try {
      const roadmap = await service.createRoadmap(
        {
          title: title.trim(),
          slug: slug.trim() || slugify(title),
          description: description.trim() || undefined,
        },
        role
      )
      // A roadmap IS a role/skill node: create the root node that represents it
      // on the canvas and in the Kho Roadmap sidebar (one record). Without it
      // the roadmap would open to an empty canvas and never list as a node.
      try {
        await service.createNode(
          {
            roadmapId: roadmap.id,
            parentId: null,
            title: roadmap.title,
            nodeType,
            positionX: 0,
            positionY: 0,
          },
          role
        )
      } catch (nodeErr) {
        toast.error(serviceErrorMessage(nodeErr))
      }
      toast.success("Đã tạo roadmap mới")
      onCreated(roadmap)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo roadmap mới</DialogTitle>
          <DialogDescription>
            Roadmap mới sẽ ở trạng thái chưa xuất bản cho đến khi bạn bật xuất
            bản trong builder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rm-title">Tên roadmap *</Label>
            <Input
              id="rm-title"
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder="VD: Lập trình Web"
              onChange={(e) => handleTitle(e.target.value)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
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
            <Label htmlFor="rm-slug">Slug</Label>
            <Input
              id="rm-slug"
              value={slug}
              placeholder="lap-trinh-web"
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-description">Mô tả (tùy chọn)</Label>
            <Textarea
              id="rm-description"
              rows={3}
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleCreate()}>
            {busy ? "Đang tạo..." : "Tạo roadmap"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
