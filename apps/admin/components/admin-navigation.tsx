"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, FileText, Image, Map, type LucideIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { BASE_PATH, NOTEBOOK_BASE_PATH, NOTION_BASE_PATH, ROADMAPS_PATH } from "@/lib/paths"

type ContentItem = {
  href: string
  label: string
  icon: LucideIcon
  active?: boolean
}

const contentItems: ContentItem[] = [
  { href: `${BASE_PATH}/fields`, label: "Lĩnh vực", icon: BookOpen },
  { href: ROADMAPS_PATH, label: "Roadmaps", icon: Map },
  { href: NOTEBOOK_BASE_PATH, label: "Notebooks", icon: FileText },
  { href: NOTION_BASE_PATH, label: "Tài liệu", icon: FileText },
  // Library currently opens the document CMS. Keep it navigable without
  // showing two active navigation entries for the same route.
  { href: NOTION_BASE_PATH, label: "Thư viện", icon: Image, active: false },
]

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNavigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className={cn("mt-5 space-y-1 px-2 text-sm", collapsed && "px-2")} aria-label="CMS">
      {!collapsed && <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Nội dung</p>}
      {contentItems.map(({ href, label, icon: Icon, active: isActive }) => {
        const active = isActive !== false && isCurrentPath(pathname, href)
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-0",
              active && "bg-muted font-semibold text-foreground"
            )}
          >
            <Icon className="size-4" />
            {!collapsed && label}
          </Link>
        )
      })}
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
