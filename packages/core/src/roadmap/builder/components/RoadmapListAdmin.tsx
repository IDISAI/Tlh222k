"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpDown, Clock3, ExternalLink, Globe2, ImageIcon, Layers3, PencilLine, Plus, Search, Tags, Trash2, Users } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
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
import type { CallerRole, RoadmapNode } from "../../types"
import { serviceErrorMessage } from "../utils/toast-messages"
import { reachesLearners, statusOf } from "../../publish-status"
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
 * Admin roadmap list (Quản lý Roadmap). A roadmap IS a role/skill node, so this
 * lists every role/skill node — the same set the builder's "Kho Roadmap"
 * sidebar shows, in table form. Client-fetched so the localStorage-backed mock
 * store is authoritative.
 */
export function RoadmapListAdmin({ role, uploadCover }: RoadmapListAdminProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "private">("all")
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
        .filter(
          (n) =>
            !n.isDeleted && (n.nodeType === "role" || n.nodeType === "skill")
        )
        .map((node) => ({ node, descendants: descendantCount(allNodes, node.id) }))
      setRows(roadmapNodes)
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
    return rows.filter(({ node }) => {
      const matchesQuery = !needle || `${node.title} ${node.slug} ${node.description ?? ""}`.toLocaleLowerCase("vi").includes(needle)
      const published = reachesLearners(statusOf(node))
      const privateBlock = statusOf(node) === "PRIVATE"
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && published) ||
        (statusFilter === "private" && privateBlock) ||
        (statusFilter === "draft" && !published && !privateBlock)
      return matchesQuery && matchesStatus
    }).sort((a, b) => {
      const aTime = a.node.updatedAt ? new Date(a.node.updatedAt).getTime() : 0
      const bTime = b.node.updatedAt ? new Date(b.node.updatedAt).getTime() : 0
      return newestFirst ? bTime - aTime : aTime - bTime
    })
  }, [newestFirst, query, rows, statusFilter])

  const publishedCount = rows?.filter(({ node }) => reachesLearners(statusOf(node))).length ?? 0
  const privateCount = rows?.filter(({ node }) => statusOf(node) === "PRIVATE").length ?? 0
  const draftCount = (rows?.length ?? 0) - publishedCount - privateCount

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Quản lý Roadmap</h1><p className="mt-1 text-sm text-muted-foreground">Tạo, tổ chức và xuất bản lộ trình học cho người học.</p></div>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tổng mục" value={rows?.length ?? "—"} icon={<Layers3 className="size-4" />} />
        <Metric label="Đã xuất bản" value={publishedCount} icon={<Globe2 className="size-4" />} tone="text-emerald-600" />
        <Metric label="Đang soạn" value={draftCount} icon={<Clock3 className="size-4" />} tone="text-amber-600" />
        <Metric label="Người học đang theo" value="12.4k" icon={<Users className="size-4" />} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center"><label className="relative block min-w-0 xl:max-w-md xl:flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc slug…" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" /></label><div className="flex flex-wrap gap-2"><FilterButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Tất cả {rows?.length ?? 0}</FilterButton><FilterButton active={statusFilter === "published"} onClick={() => setStatusFilter("published")}>Đã xuất bản {publishedCount}</FilterButton><FilterButton active={statusFilter === "draft"} onClick={() => setStatusFilter("draft")}>Đang soạn {draftCount}</FilterButton><FilterButton active={statusFilter === "private"} onClick={() => setStatusFilter("private")}>Riêng tư {privateCount}</FilterButton></div><Button type="button" variant="outline" className="xl:ml-auto" onClick={() => setNewestFirst((value) => !value)}><ArrowUpDown className="size-4" />{newestFirst ? "Cập nhật mới nhất" : "Cập nhật cũ nhất"}</Button></div>

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow>
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
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    Chưa có roadmap nào — hãy tạo roadmap đầu tiên.
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
                  <TableCell>
                    <div className="flex min-w-64 items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground" style={node.coverUrl ? { backgroundImage: `url(${node.coverUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{node.coverUrl ? null : <ImageIcon className="size-4" />}</span>
                      <span className="min-w-0"><span className="block truncate font-semibold" title={node.title}>{node.title}</span><span className="block truncate text-sm text-muted-foreground">/{node.slug} · {descendants} node</span></span>
                    </div>
                  </TableCell>
                  <TableCell><TypePill type={node.nodeType} /></TableCell>
                  <TableCell><FieldChips fields={node.fields ?? []} /></TableCell>
                  <TableCell className="max-w-64"><span className="block truncate text-sm text-muted-foreground" title={node.description ?? undefined}>{node.description || "—"}</span></TableCell>
                  <TableCell className="max-w-40"><span className="block truncate font-mono text-xs text-muted-foreground">{node.slug}</span></TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{descendants}</TableCell>
                  <TableCell><PublishState status={statusOf(node)} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" nativeButton={false} render={<a href={nodeHref(node)} />} aria-label={`Sửa ${node.title}`}><PencilLine className="size-3.5" /></Button>
                      <Button size="sm" variant="outline" nativeButton={false} render={<a href={nodeHref(node)} />} aria-label={`Mở ${node.title}`}><ExternalLink className="size-3.5" /></Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteTarget({ node, descendants })} aria-label={`Xóa ${node.title}`}><Trash2 className="size-3.5" /></Button>
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
    </div>
  )
}

function Metric({ label, value, tone, icon }: { label: string; value: string | number; tone?: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className={cn("mt-2 text-2xl font-bold tracking-tight", tone)}>{value}</p></div>
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("h-9 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors", active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted")}>{children}</button>
}

function TypePill({ type }: { type: RoadmapNode["nodeType"] }) {
  const label = type === "skill" ? "Skill" : "Role"
  return <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{label}</span>
}

function FieldChips({ fields }: { fields: NonNullable<RoadmapNode["fields"]> }) {
  if (fields.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return <div className="flex max-w-52 flex-wrap gap-1">{fields.slice(0, 2).map((field) => <span key={field.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{field.title}</span>)}{fields.length > 2 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{fields.length - 2}</span>}</div>
}

function PublishState({ status }: { status: ReturnType<typeof statusOf> }) {
  const privateBlock = status === "PRIVATE"
  const published = status === "PUBLISHED"
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", published ? "border-emerald-200 bg-emerald-50 text-emerald-700" : privateBlock ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-700")}><span className={cn("size-1.5 rounded-full", published ? "bg-emerald-500" : privateBlock ? "bg-slate-500" : "bg-amber-500")} />{published ? "Đã xuất bản" : privateBlock ? "Riêng tư" : "Đang soạn"}</span>
}
