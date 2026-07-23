"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PencilLine, Plus, Tags, Trash2, Check, X } from "lucide-react"
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
import type { CallerRole, RoadmapNode } from "../../types"
import { truncateDescription } from "../../utils"
import { serviceErrorMessage } from "../utils/toast-messages"
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
export function RoadmapListAdmin({ role }: RoadmapListAdminProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold uppercase italic">
          Quản lý Roadmap
        </h1>
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

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table className="min-w-[1000px] table-fixed">
            <colgroup>
              <col className="w-[240px]" />
              <col className="w-[92px]" />
              <col className="w-[170px]" />
              <col className="w-[280px]" />
              <col className="w-[180px]" />
              <col className="w-[80px]" />
              <col className="w-[96px]" />
              <col className="w-[130px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Lĩnh vực</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Nodes</TableHead>
                <TableHead className="text-center">Xuất bản</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    Chưa có roadmap nào — hãy tạo roadmap đầu tiên.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ node, descendants }) => (
                <TableRow
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = nodeHref(node)
                  }}
                >
                  <TableCell className="font-medium">
                    <span className="block truncate" title={node.title}>
                      {node.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        node.nodeType === "role"
                          ? "border-blue-500 text-blue-600 dark:text-blue-400"
                          : "border-purple-500 text-purple-600 dark:text-purple-400"
                      }
                    >
                      {node.nodeType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {node.fields?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {node.fields.map((field) => (
                          <span
                            key={field.id}
                            className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium"
                          >
                            {field.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span
                      className="block truncate"
                      title={node.description ?? "—"}
                    >
                      {node.description
                        ? truncateDescription(node.description, 90)
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block truncate" title={node.slug}>
                      {node.slug}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{descendants}</TableCell>
                  <TableCell>
                    <span className="flex justify-center">
                      {node.isPublished ? (
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
                        render={<a href={nodeHref(node)} />}
                      >
                        <PencilLine className="size-3.5" /> Sửa
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget({ node, descendants })}
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
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            // Stay on the list and refresh — no redirect into the new roadmap.
            setShowCreate(false)
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
