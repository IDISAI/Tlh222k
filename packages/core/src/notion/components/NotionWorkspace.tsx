"use client"

import { useCallback, useEffect, useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { NotionActions, NotionDoc } from "../types"
import { DocumentView } from "./DocumentView"
import { SearchCommand } from "./SearchCommand"
import { Sidebar } from "./Sidebar"

export interface NotionWorkspaceProps {
  /** Root document backing the roadmap article slug (loaded server-side). */
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
}: NotionWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(root.id)
  const [selectedDoc, setSelectedDoc] = useState<NotionDoc | null>(root)
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
      const doc = await actions.create({ parentDocumentId: parentId })
      bump()
      setSelectedId(doc.id)
    },
    [actions, bump]
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
