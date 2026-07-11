"use client"

import { useCallback, useEffect, useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { RoadmapService, roadmapBackendEnabled } from "../../roadmap/api"
import type { CallerRole as RoadmapRole } from "../../roadmap/types"
import type { NotionActions, NotionDoc } from "../types"
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
 * Create an `article` node (articleType "notion") under the chapter identified
 * by `chapterSlug`, placed after its existing children. Returns the node's
 * backend-assigned slug so the caller creates the matching Document with the
 * SAME slug. Client-side only — the Clerk token authorizing the write lives in
 * the browser (the gql client reads none server-side).
 */
async function createLinkedArticleNode(
  chapterSlug: string,
  role: RoadmapRole
): Promise<string | undefined> {
  const svc = new RoadmapService()
  const graph = await svc.graphBySlug(chapterSlug, { authenticated: true })
  if (!graph) return undefined
  const chapter = graph.nodes.find((n) => n.slug === chapterSlug)
  if (!chapter) return undefined
  const siblings = graph.nodes.filter((n) => n.parentId === chapter.id)
  const node = await svc.createNode(
    {
      roadmapId: chapter.roadmapId,
      parentId: chapter.id,
      title: "Untitled",
      nodeType: "article",
      articleType: "notion",
      positionX: chapter.positionX + siblings.length * 220,
      positionY: chapter.positionY + 160,
      order: siblings.length,
    },
    role
  )
  return node.slug
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
      // A1: a new TOP-LEVEL page (child of the chapter root) also spawns a
      // linked article node on the canvas. Create the NODE first so the backend
      // assigns a unique slug, then create the doc with that exact slug — this
      // keeps `node.slug === Document.slug` (the join key) in lockstep. Deeper
      // nesting stays notion-only (article is a leaf on the canvas).
      const linkToCanvas =
        canEdit &&
        !!roadmapChapterSlug &&
        !!roadmapRole &&
        parentId === root.id &&
        roadmapBackendEnabled()

      let slug: string | undefined
      if (linkToCanvas) {
        slug = await createLinkedArticleNode(
          roadmapChapterSlug!,
          roadmapRole!
        ).catch(() => undefined)
      }

      const doc = await actions.create({ parentDocumentId: parentId, slug })
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

  const publicUrl = root.slug ? `${origin}/notion/${root.slug}` : null

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
