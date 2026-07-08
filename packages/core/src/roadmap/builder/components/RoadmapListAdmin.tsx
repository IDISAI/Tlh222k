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

import { RoadmapService } from "../../roadmap.service"
import type { CallerRole, Roadmap } from "../../types"
import { serviceErrorMessage } from "../utils/toast-messages"
import { CreateRoadmapDialog } from "./CreateRoadmapDialog"
import { DeleteRoadmapDialog } from "./DeleteRoadmapDialog"

interface RoadmapListAdminProps {
  role: CallerRole
  /** Builder route prefix; rows link to `${builderBasePath}/${id}`. */
  builderBasePath?: string
}

/**
 * Admin roadmap list (design Screen 1): every roadmap incl. unpublished
 * drafts, with create / edit / delete actions. Client-fetched so the
 * localStorage-backed mock store is authoritative.
 */
export function RoadmapListAdmin({
  role,
  builderBasePath = "/roadmaps",
}: RoadmapListAdminProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Roadmap | null>(null)

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Nodes</TableHead>
                <TableHead className="text-center">Xuất bản</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roadmaps.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
                    window.location.href = `${builderBasePath}/${roadmap.id}`
                  }}
                >
                  <TableCell className="font-medium">{roadmap.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {roadmap.slug}
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
            window.location.href = `${builderBasePath}/${roadmap.id}`
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
