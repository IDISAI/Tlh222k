"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, FileText, Image, Map, ShieldCheck, type LucideIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { RoadmapService, roadmapBackendEnabled } from "@workspace/core"

import { BASE_PATH, NOTEBOOK_BASE_PATH, NOTION_BASE_PATH, ROADMAPS_PATH } from "@/lib/paths"

type ContentItem = {
  href: string
  label: string
  icon: LucideIcon
  active?: boolean
  /** Key into the counts fetched by `useContentCounts`. Omit for sections whose
   * count comes from another app or has no cheap, single-source count yet. */
  countKey?: "fields" | "roadmaps"
  /** Opens outside this app — no client-side route match, so never "active". */
  external?: boolean
}

const contentItems: ContentItem[] = [
  { href: `${BASE_PATH}/fields`, label: "Lĩnh vực", icon: BookOpen, countKey: "fields" },
  { href: ROADMAPS_PATH, label: "Roadmaps", icon: Map, countKey: "roadmaps" },
  { href: NOTEBOOK_BASE_PATH, label: "Notebooks", icon: FileText },
  { href: NOTION_BASE_PATH, label: "Tài liệu", icon: FileText },
  // Library currently opens the document CMS. Keep it navigable without
  // showing two active navigation entries for the same route.
  { href: NOTION_BASE_PATH, label: "Thư viện", icon: Image, active: false },
]

const adminItems: ContentItem[] = [
  // User management lives in the super-admin app, mounted at /super-admin by
  // the web host's Multi-Zone rewrite in both dev and prod — never duplicated
  // here. NEXT_PUBLIC_HOST_URL is already the app's convention for reaching
  // that host (see the 403 page's "Về trang chủ" link).
  {
    href: `${process.env.NEXT_PUBLIC_HOST_URL ?? ""}/super-admin/users`,
    label: "Người dùng & vai trò",
    icon: ShieldCheck,
    external: true,
  },
]

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Real counts for the two sections backed by one service and one auth model.
 * Notebooks and Tài liệu use separate stores with their own token handling —
 * wiring those in here would duplicate that plumbing rather than reuse it, so
 * their nav rows carry no count for now rather than a wrong or stale one.
 */
function useContentCounts() {
  const service = useMemo(() => new RoadmapService(), [])
  const [counts, setCounts] = useState<{ fields?: number; roadmaps?: number }>({})

  useEffect(() => {
    if (!roadmapBackendEnabled()) return
    let cancelled = false
    Promise.all([service.listAdminFields("admin"), service.listNodes()])
      .then(([fields, nodes]) => {
        if (cancelled) return
        setCounts({
          fields: fields.length,
          roadmaps: nodes.filter(
            (node) => node.nodeType !== "article" && !node.isDeleted
          ).length,
        })
      })
      .catch(() => {
        // Chrome, not content — a failed count silently shows no number rather
        // than an error state fighting for attention next to the nav label.
      })
    return () => {
      cancelled = true
    }
  }, [service])

  return counts
}

export function AdminNavigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const counts = useContentCounts()

  const renderItem = ({ href, label, icon: Icon, active: isActive, countKey, external }: ContentItem) => {
    const active = !external && isActive !== false && isCurrentPath(pathname, href)
    const count = countKey ? counts[countKey] : undefined
    return (
      <Link
        key={label}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-0",
          active && "bg-muted font-semibold text-foreground"
        )}
      >
        <Icon className="size-4" />
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between gap-2">
            {label}
            {count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {count}
              </span>
            )}
          </span>
        )}
      </Link>
    )
  }

  return (
    <nav className={cn("mt-5 space-y-4 px-2 text-sm", collapsed && "px-2")} aria-label="CMS">
      <div className="space-y-1">
        {!collapsed && <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Nội dung</p>}
        {contentItems.map(renderItem)}
      </div>
      <div className="space-y-1">
        {!collapsed && <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Quản trị</p>}
        {adminItems.map(renderItem)}
      </div>
    </nav>
  )
}

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const section =
    pathname.startsWith(ROADMAPS_PATH) ? "Roadmaps" :
    pathname.startsWith(NOTEBOOK_BASE_PATH) ? "Notebooks" :
    pathname.startsWith(NOTION_BASE_PATH) ? "Tài liệu" :
    "Lĩnh vực"

  return (
    <div className="text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">lh222k</span>
      <span className="mx-2">›</span>
      CMS
      <span className="mx-2">›</span>
      <span className="text-foreground">{section}</span>
    </div>
  )
}
