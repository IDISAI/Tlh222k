"use client"

import { Lock } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { NodeStatus, RoadmapNode } from "../../types"
import { StatusButtons } from "../../progress/components/StatusButtons"
import { useNotionContent } from "../hooks/use-notion-content"
import { MarkdownContent } from "./MarkdownContent"

interface NodeDrawerProps {
  node: RoadmapNode | null
  isAuthenticated: boolean
  onClose: () => void
  onStatusChange?: (nodeId: string, status: NodeStatus) => void
}

/** Right-side drawer: Notion content + progress controls. Esc / backdrop close. */
export function NodeDrawer({
  node,
  isAuthenticated,
  onClose,
  onStatusChange,
}: NodeDrawerProps) {
  const { markdown, loading, error } = useNotionContent(node?.notionPageId)

  return (
    <Sheet
      open={node !== null}
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b dark:border-zinc-800">
          <SheetTitle className="text-lg font-extrabold uppercase italic">
            {node?.title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {loading && (
            <>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          )}
          {!loading && error && (
            <p className="text-sm text-muted-foreground">{error}</p>
          )}
          {!loading && !error && !node?.notionPageId && (
            <p className="text-sm text-muted-foreground">Nội dung chưa có sẵn</p>
          )}
          {!loading && !error && markdown && (
            <MarkdownContent markdown={markdown} />
          )}
        </div>

        <div className="border-t p-6 dark:border-zinc-800">
          {isAuthenticated && node ? (
            <StatusButtons
              status={node.status}
              onChange={(status) => onStatusChange?.(node.id, status)}
            />
          ) : (
            <a
              href="/sign-in"
              className="flex items-center justify-center gap-2 rounded-md border-2 border-black bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Lock className="size-4" />
              Đăng nhập để theo dõi tiến độ
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
