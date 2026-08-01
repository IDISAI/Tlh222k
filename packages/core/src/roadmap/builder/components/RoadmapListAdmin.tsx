"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowUpDown,
  Clock3,
  ExternalLink,
  Globe2,
  ImageIcon,
  Layers3,
  PencilLine,
  Plus,
  Search,
  Tags,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { RoadmapService } from "../../api"
import type { CallerRole, RoadmapNode, Visibility } from "../../types"
import { serviceErrorMessage } from "../utils/toast-messages"
import { reachesLearners, statusOf } from "../../publish-status"
import { entitlementLabel } from "../../access-labels"
import { normalizeRoadmapVisibility } from "../../access-policy"
import { CreateRoadmapDialog } from "./CreateRoadmapDialog"
import { FieldManagerDialog } from "./FieldManagerDialog"
import { DeleteNodeDialog } from "./DeleteNodeDialog"

interface RoadmapListAdminProps {
  role: CallerRole
  /**
   * Accepted for API compatibility. Row/edit links are derived from the
   * current URL at runtime (see `builderHref`), so this prop is unused.
   */
  builderBasePath?: string
  /** Accepted for API compatibility; no longer used (no author column). */
  authorBasePath?: string
  /** Validates and persists a roadmap block's cover image, returning its URL. */
  uploadCover: (file: File) => Promise<string>
}

/** A roadmap-node row: a role/skill node (a role/skill node IS a roadmap). */
interface Row {
  node: RoadmapNode
  descendants: number
}

/** Total descendants of a node across the whole system. */
function descendantCount(nodes: RoadmapNode[], rootId: string): number {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id)
        grew = true
      }
    }
  }
  return ids.size - 1
}

/**
 * Admin roadmap list (Quản lý Roadmap). A roadmap block is a role, skill, or
 * chapter node, so this lists every non-article block — the same set the builder's "Kho Roadmap"
 * sidebar shows, in table form. Client-fetched so the localStorage-backed mock
 * store is authoritative.
 */
export function RoadmapListAdmin({ role, uploadCover }: RoadmapListAdminProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft" | "private"
  >("all")
  const [typeFilter, setTypeFilter] = useState<
    "all" | "role" | "skill" | "chapter"
  >("all")
  const [newestFirst, setNewestFirst] = useState(true)

  // The list page IS the builder base, so derive builder links from the current
  // URL — works via the multi-zone host or the direct admin domain. A block IS a
  // roadmap: its detail is its own composition canvas at `{base}/{node.id}`.
  const nodeHref = (node: RoadmapNode) =>
    `${window.location.pathname.replace(/\/+$/, "")}/${node.id}`

  const load = useCallback(async () => {
    try {
      const allNodes = await service.listNodes()
      const roadmapNodes = allNodes
        .filter((n) => !n.isDeleted && n.nodeType !== "article")
        .map((node) => ({
          node,
          descendants: descendantCount(allNodes, node.id),
        }))
      setRows(roadmapNodes)
      setSelectedIds((selected) =>
        selected.filter((id) => roadmapNodes.some(({ node }) => node.id === id))
      )
    } catch (error) {
      toast.error(serviceErrorMessage(error))
      setRows([])
    }
  }, [service])

  useEffect(() => {
    void load()

    const handleRestore = () => {
      void load()
    }
    window.addEventListener("bfcache-restore", handleRestore)
    return () => {
      window.removeEventListener("bfcache-restore", handleRestore)
    }
  }, [load])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLocaleLowerCase("vi")
    return rows
      .filter(({ node }) => {
        const matchesQuery =
          !needle ||
          `${node.title} ${node.slug} ${node.description ?? ""}`
            .toLocaleLowerCase("vi")
            .includes(needle)
        const published = reachesLearners(statusOf(node))
        const privateBlock = statusOf(node) === "PRIVATE"
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "published" && published) ||
          (statusFilter === "private" && privateBlock) ||
          (statusFilter === "draft" && !published && !privateBlock)
        const matchesType = typeFilter === "all" || node.nodeType === typeFilter
        return matchesQuery && matchesStatus && matchesType
      })
      .sort((a, b) => {
        const aTime = a.node.updatedAt
          ? new Date(a.node.updatedAt).getTime()
          : 0
        const bTime = b.node.updatedAt
          ? new Date(b.node.updatedAt).getTime()
          : 0
        return newestFirst ? bTime - aTime : aTime - bTime
      })
  }, [newestFirst, query, rows, statusFilter, typeFilter])

  const selectedRows = useMemo(
    () => (rows ?? []).filter(({ node }) => selectedIds.includes(node.id)),
    [rows, selectedIds]
  )
  const allFilteredSelected =
    filteredRows.length > 0 &&
    filteredRows.every(({ node }) => selectedIds.includes(node.id))

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((selected) =>
      checked
        ? [...new Set([...selected, id])]
        : selected.filter((selectedId) => selectedId !== id)
    )
  }

  const toggleAllFiltered = (checked: boolean) => {
    const visibleIds = new Set(filteredRows.map(({ node }) => node.id))
    setSelectedIds((selected) =>
      checked
        ? [...new Set([...selected, ...visibleIds])]
        : selected.filter((id) => !visibleIds.has(id))
    )
  }

  const publishedCount =
    rows?.filter(({ node }) => reachesLearners(statusOf(node))).length ?? 0
  const privateCount =
    rows?.filter(({ node }) => statusOf(node) === "PRIVATE").length ?? 0
  const draftCount = (rows?.length ?? 0) - publishedCount - privateCount
  const roleCount =
    rows?.filter(({ node }) => node.nodeType === "role").length ?? 0
  const skillCount =
    rows?.filter(({ node }) => node.nodeType === "skill").length ?? 0
  const chapterCount =
    rows?.filter(({ node }) => node.nodeType === "chapter").length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Quản lý Roadmap
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo, tổ chức và xuất bản lộ trình học cho người học.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFields(true)}
          >
            <Tags className="size-4" /> Lĩnh vực
          </Button>
          <Button type="button" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Tạo roadmap mới
          </Button>
        </div>
      </div>

      {/* No learner tile: it read a hardcoded "12.4k". This list is built from
          `listNodes`, which carries no learner figures, and an invented number
          on an admin dashboard is worse than a missing one — it gets quoted. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Tổng mục"
          value={rows?.length ?? "—"}
          icon={<Layers3 className="size-4" />}
        />
        <Metric
          label="Đã xuất bản"
          value={publishedCount}
          icon={<Globe2 className="size-4" />}
          tone="text-emerald-600"
        />
        <Metric
          label="Đang soạn"
          value={draftCount}
          icon={<Clock3 className="size-4" />}
          tone="text-amber-600"
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative block min-w-0 xl:max-w-md xl:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên hoặc slug…"
            className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            Tất cả {rows?.length ?? 0}
          </FilterButton>
          <FilterButton
            active={statusFilter === "published"}
            onClick={() => setStatusFilter("published")}
          >
            Đã xuất bản {publishedCount}
          </FilterButton>
          <FilterButton
            active={statusFilter === "draft"}
            onClick={() => setStatusFilter("draft")}
          >
            Đang soạn {draftCount}
          </FilterButton>
          <FilterButton
            active={statusFilter === "private"}
            onClick={() => setStatusFilter("private")}
          >
            Riêng tư {privateCount}
          </FilterButton>
        </div>
        <Button
          type="button"
          variant="outline"
          className="xl:ml-auto"
          onClick={() => setNewestFirst((value) => !value)}
        >
          <ArrowUpDown className="size-4" />
          {newestFirst ? "Cập nhật mới nhất" : "Cập nhật cũ nhất"}
        </Button>
      </div>

      {/* Own row, own axis: mixing this into the status chips would read as
          "Vai trò" being a fifth publish state rather than the "Loại" column
          the table already shows. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Loại</span>
        <FilterButton
          active={typeFilter === "all"}
          onClick={() => setTypeFilter("all")}
        >
          Tất cả {rows?.length ?? 0}
        </FilterButton>
        <FilterButton
          active={typeFilter === "role"}
          onClick={() => setTypeFilter("role")}
        >
          Role {roleCount}
        </FilterButton>
        <FilterButton
          active={typeFilter === "skill"}
          onClick={() => setTypeFilter("skill")}
        >
          Skill {skillCount}
        </FilterButton>
        <FilterButton
          active={typeFilter === "chapter"}
          onClick={() => setTypeFilter("chapter")}
        >
          Chapter {chapterCount}
        </FilterButton>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <span className="text-sm font-medium">
            Đã chọn {selectedRows.length} roadmap
          </span>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowBulkDelete(true)}
          >
            <Trash2 className="size-4" /> Xóa đã chọn
          </Button>
        </div>
      )}

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table className="min-w-[1220px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(checked) =>
                      toggleAllFiltered(checked === true)
                    }
                    aria-label="Chọn tất cả roadmap đang hiển thị"
                  />
                </TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Lĩnh vực</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Nodes</TableHead>
                <TableHead>Xuất bản</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    {rows && rows.length > 0
                      ? "Không có roadmap nào khớp bộ lọc hiện tại."
                      : "Chưa có roadmap nào — hãy tạo roadmap đầu tiên."}
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map(({ node, descendants }) => (
                <TableRow
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = nodeHref(node)
                  }}
                >
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(node.id)}
                      onCheckedChange={(checked) =>
                        toggleRow(node.id, checked === true)
                      }
                      aria-label={`Chọn ${node.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-64 items-center gap-3">
                      <span
                        className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground"
                        style={
                          node.coverUrl
                            ? {
                                backgroundImage: `url(${node.coverUrl})`,
                                backgroundPosition: "center",
                                backgroundSize: "cover",
                              }
                            : undefined
                        }
                      >
                        {node.coverUrl ? null : (
                          <ImageIcon className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span
                          className="block truncate font-semibold"
                          title={node.title}
                        >
                          {node.title}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          /{node.slug} · {descendants} node
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TypePill type={node.nodeType} />
                  </TableCell>
                  <TableCell>
                    <FieldChips fields={node.fields ?? []} />
                  </TableCell>
                  <TableCell className="max-w-64">
                    <span
                      className="block truncate text-sm text-muted-foreground"
                      title={node.description ?? undefined}
                    >
                      {node.description || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-40">
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {node.slug}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {descendants}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PublishState status={statusOf(node)} />
                      <EntitlementPill visibility={node.visibility} />
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<a href={nodeHref(node)} />}
                        aria-label={`Sửa ${node.title}`}
                      >
                        <PencilLine className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<a href={nodeHref(node)} />}
                        aria-label={`Mở ${node.title}`}
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget({ node, descendants })}
                        aria-label={`Xóa ${node.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showFields && (
        <FieldManagerDialog
          role={role}
          onClose={() => setShowFields(false)}
          // A rename or delete changes the chips already on screen.
          onChanged={() => void load()}
        />
      )}

      {showCreate && (
        <CreateRoadmapDialog
          role={role}
          uploadCover={uploadCover}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            // Stay on the list and refresh — no redirect into the new roadmap.
            setShowCreate(false)
            // A search or status filter active at creation time would hide the
            // new Draft row immediately after making it — clear both so what
            // was just created is the thing the admin sees.
            setQuery("")
            setStatusFilter("all")
            void load()
          }}
        />
      )}

      {deleteTarget && (
        <DeleteNodeDialog
          node={deleteTarget.node}
          childCount={deleteTarget.descendants}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              // Permanent delete: purge the block from every canvas. Other
              // independent blocks survive (LEGO) — only their link to this one
              // is cut.
              await service.deleteBlockPermanent(deleteTarget.node.id, role)
              toast.success("Đã xóa roadmap")
              setDeleteTarget(null)
              await load()
            } catch (error) {
              toast.error(serviceErrorMessage(error))
            }
          }}
        />
      )}

      {showBulkDelete && (
        <BulkDeleteRoadmapsDialog
          count={selectedRows.length}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={async () => {
            try {
              for (const { node } of selectedRows) {
                await service.deleteBlockPermanent(node.id, role)
              }
              toast.success(`Đã xóa ${selectedRows.length} roadmap`)
              setShowBulkDelete(false)
              setSelectedIds([])
              await load()
            } catch (error) {
              toast.error(serviceErrorMessage(error))
            }
          }}
        />
      )}
    </div>
  )
}

function BulkDeleteRoadmapsDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" /> Xác nhận xóa{" "}
            {count} roadmap
          </DialogTitle>
          <DialogDescription>
            Roadmap, slug, mô tả, tài liệu và liên kết canvas liên quan sẽ bị
            xóa vĩnh viễn.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm()
              setBusy(false)
            }}
          >
            {busy ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string | number
  tone?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tracking-tight", tone)}>
        {value}
      </p>
    </div>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "bg-background text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

function TypePill({ type }: { type: RoadmapNode["nodeType"] }) {
  const label =
    type === "skill" ? "Skill" : type === "chapter" ? "Chapter" : "Role"
  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
      {label}
    </span>
  )
}

function FieldChips({
  fields,
}: {
  fields: NonNullable<RoadmapNode["fields"]>
}) {
  if (fields.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex max-w-52 flex-wrap gap-1">
      {fields.slice(0, 2).map((field) => (
        <span
          key={field.id}
          className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          {field.title}
        </span>
      ))}
      {fields.length > 2 && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          +{fields.length - 2}
        </span>
      )}
    </div>
  )
}

/**
 * Who may open this block, beside whether it is published at all. The two are
 * independent axes, so an editor reading only "Đã xuất bản" cannot tell a
 * roadmap anyone can open from one that needs an AIO account.
 *
 * Rendered for BOTH entitlements on purpose. Showing a pill only for INTERNAL
 * makes a free roadmap look like one whose entitlement nobody set, which is
 * the opposite of what it is.
 */
function EntitlementPill({ visibility }: { visibility?: Visibility | null }) {
  const internal = normalizeRoadmapVisibility(visibility) === "INTERNAL"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        internal
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {entitlementLabel(visibility)}
    </span>
  )
}

function PublishState({ status }: { status: ReturnType<typeof statusOf> }) {
  const privateBlock = status === "PRIVATE"
  const published = status === "PUBLISHED"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        published
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : privateBlock
            ? "border-slate-200 bg-slate-50 text-slate-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          published
            ? "bg-emerald-500"
            : privateBlock
              ? "bg-slate-500"
              : "bg-amber-500"
        )}
      />
      {published ? "Đã xuất bản" : privateBlock ? "Riêng tư" : "Đang soạn"}
    </span>
  )
}
