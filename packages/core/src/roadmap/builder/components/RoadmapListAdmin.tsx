"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, PencilLine, Plus, Trash2, X } from "lucide-react"
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
import type { CallerRole, Roadmap } from "../../types"
import {
  formatDate,
  formatRelativeTime,
  truncateDescription,
} from "../../utils"
import { serviceErrorMessage } from "../utils/toast-messages"
import { CreateRoadmapDialog } from "./CreateRoadmapDialog"
import { DeleteRoadmapDialog } from "./DeleteRoadmapDialog"

interface RoadmapListAdminProps {
  role: CallerRole
  /** Builder route prefix; rows link to `${builderBasePath}/${id}`. */
  builderBasePath?: string
  /**
   * Base path for author profile links (`${authorBasePath}/${authorId}`).
   * Configurable so admin vs super-admin apps point to their own user route.
   */
  authorBasePath?: string
}

/**
 * Admin roadmap list (design Screen 1): every roadmap incl. unpublished
 * drafts, with create / edit / delete actions. Client-fetched so the
 * localStorage-backed mock store is authoritative.
 */
export function RoadmapListAdmin({
  role,
  builderBasePath = "/roadmaps",
  authorBasePath = "/super-admin/users",
}: RoadmapListAdminProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Roadmap | null>(null)

  // `builderBasePath` is computed at build time from NODE_ENV, which breaks
  // navigation when the zone is reached through the other access mode (dev via
  // the multi-zone host, prod via the direct admin domain). The list page IS
  // the builder base, so derive the target from the current URL instead.
  const builderHref = (id: string) =>
    `${window.location.pathname.replace(/\/+$/, "")}/${id}`

  const load = useCallback(async () => {
    try {
      setRoadmaps(await service.listAdmin(role))
    } catch (error) {
      toast.error(serviceErrorMessage(error))
      setRoadmaps([])
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

      {roadmaps === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table className="min-w-[1180px] table-fixed">
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[300px]" />
              <col className="w-[160px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[72px]" />
              <col className="w-[96px]" />
              <col className="w-[150px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tác giả</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="text-right">Nodes</TableHead>
                <TableHead className="text-center">Xuất bản</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roadmaps.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    Chưa có roadmap nào — hãy tạo roadmap đầu tiên.
                  </TableCell>
                </TableRow>
              )}
              {roadmaps.map((roadmap) => (
                <TableRow
                  key={roadmap.id}
                  className="cursor-pointer"
                  // Row click opens the builder/detail page (item: click roadmap → detail).
                  onClick={() => {
                    window.location.href = builderHref(roadmap.id)
                  }}
                >
                  <TableCell className="font-medium">
                    <span className="block truncate" title={roadmap.title}>
                      {roadmap.title}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span
                      className="block truncate"
                      title={roadmap.description ?? "—"}
                    >
                      {roadmap.description
                        ? truncateDescription(roadmap.description, 80)
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block truncate" title={roadmap.slug}>
                      {roadmap.slug}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {roadmap.author ?? roadmap.authorId ? (
                      <a
                        href={`${authorBasePath}/${roadmap.author?.id ?? roadmap.authorId}`}
                        className="block truncate text-primary underline-offset-4 hover:underline"
                        title={roadmap.author?.name ?? roadmap.authorId ?? ""}
                      >
                        {roadmap.author?.name ?? roadmap.authorId}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(roadmap.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(roadmap.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {roadmap.nodeCount}
                  </TableCell>
                  <TableCell>
                    <span className="flex justify-center">
                      {roadmap.isPublished ? (
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
                        render={
                          <a href={`${builderBasePath}/${roadmap.id}`} />
                        }
                      >
                        <PencilLine className="size-3.5" /> Sửa
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(roadmap)}
                      >
                        <Trash2 className="size-3.5" /> Xóa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showCreate && (
        <CreateRoadmapDialog
          role={role}
          onClose={() => setShowCreate(false)}
          onCreated={(roadmap) => {
            setShowCreate(false)
            window.location.href = builderHref(roadmap.id)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteRoadmapDialog
          roadmap={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await service.deleteRoadmap(deleteTarget.id, role)
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
