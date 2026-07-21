"use client"

import { useCallback, useEffect, useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { RoadmapService, roadmapBackendEnabled } from "../../roadmap/api"
import type { CallerRole as RoadmapRole } from "../../roadmap/types"
import type { NotionActions, NotionDoc } from "../types"
import { OPEN_DOC_EVENT, type NotionPageRef } from "./blocks"
import { DocumentView } from "./DocumentView"
import { SearchCommand } from "./SearchCommand"
import { Sidebar } from "./Sidebar"

export interface NotionWorkspaceProps {
  /** Root document backing the roadmap chapter slug (loaded server-side). */
  root: NotionDoc
  /**
   * UI hint ONLY — never a trust boundary. Web passes false (read-only,
   * published docs), admin passes true after its getRole() gate. Every
   * injected Server Action re-checks the caller's role on the server.
   */
  canEdit: boolean
  actions: NotionActions
  /** Public web-zone origin for "copy public URL" (defaults to own origin). */
  publicOrigin?: string
  /** Deep-link: pre-select this doc on mount (an article page under root). */
  initialSelectedId?: string
  /**
   * Roadmap chapter slug this doc tree belongs to (QĐ-1 A1). When set with
   * `roadmapRole` + canEdit, creating a TOP-LEVEL page also spawns a linked
   * `article` node under the chapter on the canvas. Omitted on web (read-only).
   */
  roadmapChapterSlug?: string
  /** Caller role for the client-side roadmap write (article-node create). */
  roadmapRole?: RoadmapRole
}

/**
 * Create an `article` node (articleType "notion") on the canvas under
 * `parentNodeId` (the chapter node for top-level pages, an article node for
 * sub-pages — notion-article-node Req 4.1/4.2), placed after that parent's
 * existing children. Returns the node's backend-assigned slug so the caller
 * creates the matching Document with the SAME slug. Client-side only — the
 * Clerk token authorizing the write lives in the browser (the gql client
 * reads none server-side).
 */
async function createLinkedArticleNode(
  chapterSlug: string,
  role: RoadmapRole,
  parentNodeId: string
): Promise<string | undefined> {
  const svc = new RoadmapService()
  const graph = await svc.graphBySlug(chapterSlug, { authenticated: true })
  if (!graph) return undefined
  const parent = graph.nodes.find((n) => n.id === parentNodeId)
  if (!parent) return undefined
  const siblings = graph.nodes.filter((n) => n.parentId === parent.id)
  const node = await svc.createNode(
    {
      roadmapId: parent.roadmapId,
      parentId: parent.id,
      title: "Untitled",
      nodeType: "article",
      articleType: "notion",
      positionX: parent.positionX + siblings.length * 220,
      positionY: parent.positionY + 160,
      order: siblings.length,
    },
    role
  )
  return node.slug
}

/**
 * Compensating transaction (Req 4.7): permanently remove the node created a
 * moment ago when its Document failed to create — no dangling canvas node.
 */
async function deleteLinkedArticleNode(
  chapterSlug: string,
  nodeSlug: string,
  role: RoadmapRole
): Promise<void> {
  const svc = new RoadmapService()
  const graph = await svc.graphBySlug(chapterSlug, { authenticated: true })
  const node = graph?.nodes.find((n) => n.slug === nodeSlug)
  if (node) await svc.deleteNode(node.id, role)
}

/**
 * Resolve which canvas node a new sidebar page should hang under (Req 4.1):
 * a child of the ROOT doc gets the chapter node; a child of an Article_Doc
 * (doc whose slug matches an article node) gets that node; a child of a
 * Child_Doc (no matching node) gets none → Document only (Req 4.4/4.5).
 */
async function resolveParentNodeId(
  chapterSlug: string,
  parentDocSlug: string | null,
  isRootChild: boolean
): Promise<string | undefined> {
  const svc = new RoadmapService()
  const graph = await svc.graphBySlug(chapterSlug, { authenticated: true })
  if (!graph) return undefined
  if (isRootChild) {
    return graph.nodes.find((n) => n.slug === chapterSlug)?.id
  }
  if (!parentDocSlug) return undefined
  return graph.nodes.find(
    (n) =>
      n.slug === parentDocSlug &&
      n.nodeType === "article" &&
      n.articleType === "notion" &&
      !n.isDeleted
  )?.id
}

/**
 * The ONE Notion workspace shared by web (:3000, read-only) and admin
 * (:3002, editor) — mirrors the RoadmapViewer precedent so the two zones can
 * never look or behave differently. All differences hang off `canEdit`.
 */
export function NotionWorkspace({
  root,
  canEdit,
  actions,
  publicOrigin,
  initialSelectedId,
  roadmapChapterSlug,
  roadmapRole,
}: NotionWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? root.id)
  const [selectedDoc, setSelectedDoc] = useState<NotionDoc | null>(
    initialSelectedId && initialSelectedId !== root.id ? null : root
  )
  const [docLoading, setDocLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [origin, setOrigin] = useState(publicOrigin ?? "")

  // Sidebar starts collapsed on small screens (full mobile responsiveness).
  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true)
    if (!publicOrigin) setOrigin(window.location.origin)
  }, [publicOrigin])

  // Load the selected document (skeleton only when actually switching pages).
  useEffect(() => {
    let cancelled = false
    setDocLoading((prev) => prev || selectedId !== root.id)
    void actions.getById(selectedId).then((doc) => {
      if (cancelled) return
      setSelectedDoc(doc)
      setDocLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Cmd/Ctrl+K opens search (admin zone only).
  useEffect(() => {
    if (!canEdit) return
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [canEdit])

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    if (window.innerWidth < 768) setCollapsed(true)
  }, [])

  // Page chips inside the editor (mention / link_to_page) select their target
  // doc via a DOM event — no prop drilling through BlockNote (Req 12.14/12.15).
  useEffect(() => {
    const onOpenDoc = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) setSelectedId(id)
    }
    window.addEventListener(OPEN_DOC_EVENT, onOpenDoc)
    return () => window.removeEventListener(OPEN_DOC_EVENT, onOpenDoc)
  }, [])

  // Non-archived pages for @-mentions and link_to_page pickers (admin only).
  const getPages = useCallback(async (): Promise<NotionPageRef[]> => {
    if (!actions.getSearch) return []
    const docs = await actions.getSearch()
    return docs.map((d) => ({ id: d.id, title: d.title, icon: d.icon }))
  }, [actions])

  const handleDocChanged = useCallback(
    (doc: NotionDoc, treeAffecting: boolean) => {
      setSelectedDoc((prev) => (prev?.id === doc.id ? doc : prev))
      if (treeAffecting) bump()
    },
    [bump]
  )

  const handleCreateChild = useCallback(
    async (parentId: string) => {
      if (!actions.create) return
      // notion-article-node Req 4: a new sidebar page ALSO spawns a linked
      // article node on the canvas — under the chapter node for top-level
      // pages, under the matching article node for sub-pages. The NODE is
      // created first so the backend assigns a unique slug, then the doc is
      // created with that exact slug (`node.slug === Document.slug` join key).
      // Pages under a Child_Doc (no matching node) stay notion-only.
      const canLink =
        canEdit && !!roadmapChapterSlug && !!roadmapRole && roadmapBackendEnabled()

      let parentNodeId: string | undefined
      if (canLink) {
        const parentDoc =
          parentId === root.id ? null : await actions.getById(parentId)
        parentNodeId = await resolveParentNodeId(
          roadmapChapterSlug!,
          parentDoc?.slug ?? null,
          parentId === root.id
        ).catch(() => undefined)
      }

      if (canLink && parentNodeId) {
        // 1. Node first — a node failure stops everything (Req 4.6).
        let slug: string | undefined
        try {
          slug = await createLinkedArticleNode(
            roadmapChapterSlug!,
            roadmapRole!,
            parentNodeId
          )
        } catch {
          slug = undefined
        }
        if (!slug) {
          toast.error("Không thể tạo node trên canvas.")
          return
        }

        // 2. Document with the node's slug; failure rolls the node back
        //    (compensating transaction, Req 4.7).
        let doc: NotionDoc
        try {
          doc = await actions.create({ parentDocumentId: parentId, slug })
        } catch {
          await deleteLinkedArticleNode(
            roadmapChapterSlug!,
            slug,
            roadmapRole!
          ).catch(() => {})
          toast.error("Không thể tạo trang Notion. Đã hủy tạo node.")
          return
        }
        bump()
        setSelectedId(doc.id)
        return
      }

      // Child_Doc parent / viewer zone / mock mode: Document only
      // (Req 4.4/4.5/4.8/4.9).
      const doc = await actions.create({ parentDocumentId: parentId })
      bump()
      setSelectedId(doc.id)
    },
    [actions, bump, canEdit, roadmapChapterSlug, roadmapRole, root.id]
  )

  // Reverse title sync (QĐ-2): a title edit in notion pushes to the linked
  // roadmap node with the same slug. Client-side (browser holds the token);
  // no-op on web / mock / when no chapter is linked.
  const syncNodeTitle = useCallback(
    async (slug: string, title: string) => {
      if (!roadmapChapterSlug || !roadmapRole || !roadmapBackendEnabled()) return
      try {
        const svc = new RoadmapService()
        const graph = await svc.graphBySlug(roadmapChapterSlug, {
          authenticated: true,
        })
        const node = graph?.nodes.find((n) => n.slug === slug)
        if (node) await svc.updateNode(node.id, { title }, roadmapRole)
      } catch {
        // best-effort — the notion title already saved
      }
    },
    [roadmapChapterSlug, roadmapRole]
  )

  const handleArchive = useCallback(
    async (id: string) => {
      if (!actions.archive) return
      await actions.archive(id)
      bump()
      if (selectedId === id) setSelectedId(root.id)
    },
    [actions, bump, selectedId, root.id]
  )

  const handleRestore = useCallback(
    async (id: string) => {
      if (!actions.restore) return
      await actions.restore(id)
      bump()
    },
    [actions, bump]
  )

  const handleRemove = useCallback(
    async (id: string) => {
      if (!actions.remove) return
      await actions.remove(id)
      bump()
      if (selectedId === id) setSelectedId(root.id)
    },
    [actions, bump, selectedId, root.id]
  )

  // Drag-to-nest / "Chuyển vào trang khác": re-parent a page. The service
  // rejects moving a page into its own subtree (cycle guard).
  const handleMove = useCallback(
    async (id: string, parentDocumentId: string | null) => {
      if (!actions.move) return
      try {
        await actions.move(id, parentDocumentId)
        bump()
      } catch {
        toast.error("Không thể chuyển trang vào vị trí này.")
      }
    },
    [actions, bump]
  )

  const publicUrl =
    root.slug && selectedDoc?.slug
      ? selectedDoc.id === root.id
        ? `${origin}/notion/${root.slug}`
        : `${origin}/notion/${root.slug}?page=${encodeURIComponent(selectedDoc.slug)}`
      : null

  return (
    <div className="relative flex h-[calc(100svh-57px)] overflow-hidden bg-background">
      {!collapsed && (
        <Sidebar
          root={root}
          canEdit={canEdit}
          actions={actions}
          selectedId={selectedId}
          refreshKey={refreshKey}
          onSelect={handleSelect}
          onCreateChild={handleCreateChild}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onRemove={handleRemove}
          onMove={handleMove}
          onCollapse={() => setCollapsed(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
      )}

      <main className="h-full min-w-0 flex-1">
        <DocumentView
          doc={selectedDoc}
          loading={docLoading}
          canEdit={canEdit}
          actions={actions}
          publicUrl={publicUrl}
          onDocChanged={handleDocChanged}
          onTitleSync={canEdit ? syncNodeTitle : undefined}
          getPages={canEdit && actions.getSearch ? getPages : undefined}
          topLeft={
            collapsed ? (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Mở sidebar"
                onClick={() => setCollapsed(false)}
              >
                <Menu />
              </Button>
            ) : undefined
          }
        />
      </main>

      {canEdit && actions.getSearch && (
        <SearchCommand
          open={searchOpen}
          onOpenChange={setSearchOpen}
          getSearch={actions.getSearch}
          onSelect={(doc) => handleSelect(doc.id)}
        />
      )}
    </div>
  )
}
