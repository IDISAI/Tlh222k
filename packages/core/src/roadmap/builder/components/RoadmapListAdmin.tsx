"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, PencilLine, Plus, Trash2, X } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { RoadmapService } from "../../api"
import type { CallerRole, Roadmap, RoadmapNode } from "../../types"
import { formatRelativeTime, truncateDescription } from "../../utils"
import { serviceErrorMessage } from "../utils/toast-messages"
import { CreateRoadmapDialog } from "./CreateRoadmapDialog"
import { DeleteNodeDialog } from "./DeleteNodeDialog"
import { DeleteRoadmapDialog } from "./DeleteRoadmapDialog"

interface RoadmapListAdminProps {
  role: CallerRole
  /**
   * Accepted for API compatibility. Row/edit links are derived from the
   * current URL at runtime (see `builderHref`) so they work regardless of how
   * the admin zone is reached, so this prop is no longer used.
   */
  builderBasePath?: string
  /**
   * Base path for author profile links (`${authorBasePath}/${authorId}`).
   * Configurable so admin vs super-admin apps point to their own user route.
   */
  authorBasePath?: string
}

/**
 * One table row. A row is either a top-level roadmap or a role/skill node —
 * because a role/skill node IS a roadmap (its detail is a rooted view of the
 * same tree). Both are listed flat so every "roadmap" is reachable here.
 */
type Row =
  | { kind: "roadmap"; roadmap: Roadmap }
  | { kind: "node"; node: RoadmapNode; descendants: number }

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
 * Admin roadmap list (design Screen 1): every top-level roadmap plus every
 * role/skill node (each a "roadmap"), with create / edit / delete actions.
 * Client-fetched so the localStorage-backed mock store is authoritative.
 */
export function RoadmapListAdmin({
  role,
  authorBasePath = "/super-admin/users",
}: RoadmapListAdminProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)

  // The list page IS the builder base, so derive builder links from the
  // current URL. Works whether the admin zone is reached via the multi-zone
  // host or the direct admin domain.
  const builderHref = (roadmapId: string, nodeId?: string) => {
    const base = `${window.location.pathname.replace(/\/+$/, "")}/${roadmapId}`
    return nodeId ? `${base}?node=${nodeId}` : base
  }

  const rowHref = (row: Row) =>
    row.kind === "roadmap"
      ? builderHref(row.roadmap.id)
      : builderHref(row.node.roadmapId, row.node.id)

  const load = useCallback(async () => {
    try {
      const [roadmaps, allNodes] = await Promise.all([
        service.listAdmin(role),
        service.listNodes(),
      ])
      const roadmapRows: Row[] = roadmaps.map((roadmap) => ({
        kind: "roadmap",
        roadmap,
      }))
      const nodeRows: Row[] = allNodes
        .filter(
          (n) =>
            !n.isDeleted && (n.nodeType === "role" || n.nodeType === "skill")
        )
        .map((node) => ({
          kind: "node",
          node,
          descendants: descendantCount(allNodes, node.id),
        }))
      setRows([...roadmapRows, ...nodeRows])
    } catch (error) {
      toast.error(serviceErrorMessage(error))
      setRows([])
    }
  }, [service, role])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold uppercase italic">
          Quản lý Roadmap
        </h1>
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" /> Tạo roadmap mới
        </Button>
      </div>

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table className="min-w-[1120px] table-fixed">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[92px]" />
              <col className="w-[280px]" />
              <col className="w-[160px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[72px]" />
              <col className="w-[96px]" />
              <col className="w-[130px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tác giả</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="text-right">Nodes</TableHead>
                <TableHead className="text-center">Xuất bản</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    Chưa có roadmap nào — hãy tạo roadmap đầu tiên.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => {
                const isRoadmap = row.kind === "roadmap"
                const title = isRoadmap ? row.roadmap.title : row.node.title
                const description = isRoadmap
                  ? row.roadmap.description
                  : row.node.description
                const slug = isRoadmap ? row.roadmap.slug : row.node.slug
                const isPublished = isRoadmap
                  ? row.roadmap.isPublished
                  : row.node.isPublished === true
                const count = isRoadmap ? row.roadmap.nodeCount : row.descendants
                const kindLabel = isRoadmap ? "roadmap" : row.node.nodeType
                const kindClass = isRoadmap
                  ? "border-zinc-400 text-muted-foreground"
                  : row.node.nodeType === "role"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-purple-500 text-purple-600 dark:text-purple-400"

                return (
                  <TableRow
                    key={`${row.kind}:${isRoadmap ? row.roadmap.id : row.node.id}`}
                    className="cursor-pointer"
                    onClick={() => {
                      window.location.href = rowHref(row)
                    }}
                  >
                    <TableCell className="font-medium">
                      <span className="block truncate" title={title}>
                        {title}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={kindClass}>
                        {kindLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span
                        className="block truncate"
                        title={description ?? "—"}
                      >
                        {description
                          ? truncateDescription(description, 80)
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="block truncate" title={slug}>
                        {slug}
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isRoadmap &&
                      (row.roadmap.author ?? row.roadmap.authorId) ? (
                        <a
                          href={`${authorBasePath}/${row.roadmap.author?.id ?? row.roadmap.authorId}`}
                          className="block truncate text-primary underline-offset-4 hover:underline"
                          title={
                            row.roadmap.author?.name ??
                            row.roadmap.authorId ??
                            ""
                          }
                        >
                          {row.roadmap.author?.name ?? row.roadmap.authorId}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {isRoadmap ? formatRelativeTime(row.roadmap.updatedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                    <TableCell>
                      <span className="flex justify-center">
                        {isPublished ? (
                          <Check className="size-4 text-emerald-600" />
                        ) : (
                          <X className="size-4 text-muted-foreground" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<a href={rowHref(row)} />}
                        >
                          <PencilLine className="size-3.5" /> Sửa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="size-3.5" /> Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {showCreate && (
        <CreateRoadmapDialog
          role={role}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            // Stay on the list and refresh the table — no redirect into the
            // new roadmap.
            setShowCreate(false)
            void load()
          }}
        />
      )}

      {deleteTarget?.kind === "roadmap" && (
        <DeleteRoadmapDialog
          roadmap={deleteTarget.roadmap}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await service.deleteRoadmap(deleteTarget.roadmap.id, role)
              toast.success("Đã xóa roadmap")
              setDeleteTarget(null)
              await load()
            } catch (error) {
              toast.error(serviceErrorMessage(error))
            }
          }}
        />
      )}

      {deleteTarget?.kind === "node" && (
        <DeleteNodeDialog
          node={deleteTarget.node}
          childCount={deleteTarget.descendants}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await service.deleteNode(deleteTarget.node.id, role)
              toast.success("Đã xóa node")
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
