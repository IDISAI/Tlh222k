"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { BASE_PATH } from "@/lib/paths"
import { AdminNavigation } from "@/components/admin-navigation"

export function AdminSidebar({ role }: { role: string | null }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex", collapsed ? "w-[68px]" : "w-60")}>
      <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        <a href={BASE_PATH || "/"} aria-label="lh222k CMS" className="flex items-center gap-2 text-xl font-extrabold tracking-[-1px]">
          <span>{collapsed ? "lh" : "lh222k"}</span>{!collapsed && <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">CMS</span>}
        </a>
        <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Mở sidebar" : "Thu gọn sidebar"} className={cn("grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "absolute left-14 top-4 z-10 bg-background shadow-sm")}>{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</button>
      </div>
      <AdminNavigation collapsed={collapsed} />
      <div className={cn("mt-auto border-t p-3 text-sm", collapsed && "grid place-items-center p-3")}><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-muted text-xs">A</span>{!collapsed && <span><b className="block text-xs">Administrator</b><span className="text-xs text-muted-foreground">{role ?? "admin"}</span></span>}</div></div>
    </aside>
  )
}
