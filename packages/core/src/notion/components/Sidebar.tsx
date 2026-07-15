"use client"

import { useEffect, useRef, useState } from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  ChevronRight,
  ChevronsLeft,
  CornerUpRight,
  File,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import type { NotionActions, NotionDoc } from "../types"
import { TrashBox } from "./TrashBox"

interface SidebarProps {
  root: NotionDoc
  canEdit: boolean
  actions: NotionActions
  selectedId: string
  refreshKey: number
  onSelect: (id: string) => void
  onCreateChild: (parentId: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onRestore: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  /** Re-parent a page ("Chuyển vào trang khác"); null = top level. */
  onMove: (id: string, parentDocumentId: string | null) => Promise<void>
  onCollapse: () => void
  onOpenSearch: () => void
}

/**
 * Collapsible + resizable page tree. Viewer/guest zone renders the same tree
 * (published pages only, filtered server-side) without any write affordances.
 */
export function Sidebar(props: SidebarProps) {
  const { root, canEdit, onCollapse, onOpenSearch } = props
  const [width, setWidth] = useState(260)
  // "Chuyển vào trang khác" target — the page whose parent we're changing.
  const [moveTarget, setMoveTarget] = useState<NotionDoc | null>(null)
  const treeProps: TreeProps = { ...props, onRequestMove: setMoveTarget }

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const move = (ev: PointerEvent) =>
      setWidth(Math.min(480, Math.max(200, startW + ev.clientX - startX)))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <aside
      style={{ width }}
      className="group/sidebar relative z-40 flex h-full shrink-0 flex-col border-r bg-background max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:shadow-xl"
    >
      <div className="flex items-center justify-between p-2">
        <span className="truncate px-1 text-sm font-semibold">
          {root.icon ? `${root.icon} ` : ""}
          {root.title}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Thu gọn sidebar"
          className="opacity-0 transition-opacity group-hover/sidebar:opacity-100"
          onClick={onCollapse}
        >
          <ChevronsLeft />
        </Button>
      </div>

      {canEdit && (
        <div className="px-2 pb-1">
          <SidebarAction
            icon={<Search className="size-4" />}
            label="Tìm kiếm"
            hint="⌘K"
            onClick={onOpenSearch}
          />
          <SidebarAction
            icon={<Plus className="size-4" />}
            label="Trang mới"
            onClick={() => void props.onCreateChild(root.id)}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-1">
        <DocItem {...treeProps} doc={root} level={0} isRoot />
      </div>

      {canEdit && (
        <div className="border-t p-2">
          <TrashBox
            getTrash={props.actions.getTrash ?? (() => Promise.resolve([]))}
            onRestore={props.onRestore}
            onRemove={props.onRemove}
          >
            <SidebarAction
              icon={<Trash2 className="size-4" />}
              label="Thùng rác"
            />
          </TrashBox>
        </div>
      )}

      {canEdit && (
        <MovePageDialog
          target={moveTarget}
          rootId={root.id}
          getSearch={props.actions.getSearch}
          onMove={props.onMove}
          onClose={() => setMoveTarget(null)}
        />
      )}

      {/* Resize handle */}
      <div
        onPointerDown={startResize}
        className="absolute top-0 right-0 h-full w-1 cursor-ew-resize opacity-0 transition-opacity hover:bg-primary/20 group-hover/sidebar:opacity-100 max-md:hidden"
      />
    </aside>
  )
}

function SidebarAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {hint && (
        <kbd className="rounded border bg-muted px-1 text-[10px] text-muted-foreground">
          {hint}
        </kbd>
      )}
    </button>
  )
}

// ── Tree ─────────────────────────────────────────────────────────────────────

type TreeProps = Omit<SidebarProps, "onCollapse" | "onOpenSearch"> & {
  /** Open the "Chuyển vào trang khác" picker for this page. */
  onRequestMove: (doc: NotionDoc) => void
}

function DocItem({
  doc,
  level,
  isRoot = false,
  dragRef,
  dragStyle,
  dragProps,
  ...tree
}: TreeProps & {
  doc: NotionDoc
  level: number
  isRoot?: boolean
  dragRef?: (node: HTMLElement | null) => void
  dragStyle?: React.CSSProperties
  dragProps?: Record<string, unknown>
}) {
  const [expanded, setExpanded] = useState(isRoot)
  const selected = tree.selectedId === doc.id

  // Deep-link support (notion-article-node Req 5.1): the pre-selected item
  // scrolls into view so the admin never hunts for it in a long tree.
  const rowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  return (
    <div ref={dragRef} style={dragStyle} {...dragProps}>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        onClick={() => tree.onSelect(doc.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") tree.onSelect(doc.id)
        }}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        className={cn(
          "group/item flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pr-1 text-sm text-muted-foreground transition-colors hover:bg-muted",
          selected && "bg-muted font-medium text-foreground"
        )}
      >
        <button
          type="button"
          title={expanded ? "Thu gọn" : "Mở rộng"}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="rounded-sm p-0.5 hover:bg-foreground/10"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-90"
            )}
          />
        </button>
        {doc.icon ? (
          <span className="shrink-0 text-sm leading-none">{doc.icon}</span>
        ) : (
          <File className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{doc.title}</span>

        {tree.canEdit && (
          <span className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover/item:opacity-100">
            {!isRoot && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem
                    onClick={() => tree.onRequestMove(doc)}
                  >
                    <CornerUpRight className="size-4" /> Chuyển vào trang khác
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void tree.onArchive(doc.id)}
                  >
                    <Trash2 className="size-4" /> Lưu trữ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              title="Thêm trang con"
              onClick={(e) => {
                e.stopPropagation()
                void tree.onCreateChild(doc.id).then(() => setExpanded(true))
              }}
            >
              <Plus />
            </Button>
          </span>
        )}
      </div>

      {expanded && <DocList {...tree} parentId={doc.id} level={level + 1} />}
    </div>
  )
}

/** Children of one parent — its own DndContext so sorting stays sibling-only. */
function DocList({
  parentId,
  level,
  ...tree
}: TreeProps & { parentId: string; level: number }) {
  const [docs, setDocs] = useState<NotionDoc[] | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    let cancelled = false
    void tree.actions.getChildren(parentId).then((result) => {
      if (!cancelled) setDocs(result)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, tree.refreshKey])

  if (docs === null) {
    return (
      <div className="space-y-1 py-1" style={{ paddingLeft: `${level * 12 + 8}px` }}>
        <Skeleton className="h-5 w-4/5" />
      </div>
    )
  }

  if (docs.length === 0) {
    return (
      <p
        className="py-1 text-xs text-muted-foreground/60"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        Không có trang con
      </p>
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = docs.findIndex((d) => d.id === active.id)
    const newIndex = docs.findIndex((d) => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(docs, oldIndex, newIndex)
    setDocs(next) // optimistic; server order confirmed on next refetch
    void tree.actions.reorder?.(
      parentId,
      next.map((d) => d.id)
    )
  }

  const items = docs.map((doc) =>
    tree.canEdit ? (
      <SortableDocItem key={doc.id} {...tree} doc={doc} level={level} />
    ) : (
      <DocItem key={doc.id} {...tree} doc={doc} level={level} />
    )
  )

  if (!tree.canEdit) return <div>{items}</div>

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={docs.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        {items}
      </SortableContext>
    </DndContext>
  )
}

function SortableDocItem(
  props: TreeProps & { doc: NotionDoc; level: number }
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.doc.id })

  return (
    <DocItem
      {...props}
      dragRef={setNodeRef}
      dragStyle={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      dragProps={{ ...attributes, ...listeners }}
    />
  )
}

/**
 * "Chuyển vào trang khác" picker: pick a destination page (or the top level)
 * to re-parent `target` under. The moved page itself is excluded; the service
 * rejects a move into the page's own subtree, so cycles can't form even though
 * descendants aren't filtered client-side (the lazy tree hasn't loaded them).
 */
function MovePageDialog({
  target,
  rootId,
  getSearch,
  onMove,
  onClose,
}: {
  target: NotionDoc | null
  rootId: string
  getSearch?: () => Promise<NotionDoc[]>
  onMove: (id: string, parentDocumentId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [docs, setDocs] = useState<NotionDoc[]>([])

  // Exclude the moved page and the chapter root (root is offered as the
  // explicit "top level" choice instead).
  useEffect(() => {
    if (!target || !getSearch) return
    let cancelled = false
    void getSearch().then((result) => {
      if (!cancelled) {
        setDocs(result.filter((d) => d.id !== target.id && d.id !== rootId))
      }
    })
    return () => {
      cancelled = true
    }
  }, [target, getSearch, rootId])

  const pick = (parentId: string) => {
    if (target) void onMove(target.id, parentId)
    onClose()
  }

  return (
    <CommandDialog
      open={target !== null}
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
      title="Chuyển trang"
      description={`Chọn trang đích cho “${target?.title ?? ""}”`}
    >
      <CommandInput placeholder="Tìm trang đích..." />
      <CommandList>
        <CommandEmpty>Không tìm thấy trang nào.</CommandEmpty>
        <CommandGroup heading="Cấp cao nhất">
          {/* Top level of THIS chapter workspace = a direct child of the
              chapter root doc (A1 model), not a detached orphan. */}
          <CommandItem value="__top-level__" onSelect={() => pick(rootId)}>
            <CornerUpRight className="size-4" />
            <span>Chuyển lên cấp cao nhất</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Trang">
          {docs.map((doc) => (
            <CommandItem
              key={doc.id}
              value={`${doc.title}-${doc.id}`}
              onSelect={() => pick(doc.id)}
            >
              {doc.icon ? (
                <span className="text-base">{doc.icon}</span>
              ) : (
                <File className="size-4" />
              )}
              <span className="truncate">{doc.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
