"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Map, NotebookPen, Users } from "lucide-react"
import { ThemeToggle } from "@workspace/core"
import { cn } from "@workspace/ui/lib/utils"

import { AuthHeader } from "@/components/auth-header"

type ProductTab = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Renders the tiny uppercase "New" pill next to the label. */
  isNew?: boolean
}

const TABS: ProductTab[] = [
  { href: "/roadmaps", label: "Roadmaps", icon: Map },
  { href: "/notebooks", label: "Notebooks", icon: NotebookPen },
  { href: "/community", label: "Community", icon: Users, isNew: true },
]

function ProductTabLink({
  tab: { href, label, icon: Icon, isNew },
  active,
  className,
}: {
  tab: ProductTab
  active: boolean
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 font-semibold transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <Icon className="size-5" />
      {label}
      {isNew ? (
        <span className="rounded-full bg-foreground px-1.5 py-[3px] text-[8px] font-bold uppercase leading-tight tracking-[0.32px] text-background">
          New
        </span>
      ) : null}
    </Link>
  )
}

/**
 * Airbnb-style top nav: white surface, one hairline underneath, wordmark
 * flush left, product tabs dead center, account utilities flush right. The
 * active tab is marked by a 2px ink underline — no fill, no pill.
 *
 * Below 768px the centre slot has no room, so the tabs drop to their own
 * scrollable row beneath the wordmark rather than disappearing.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto grid h-[70px] max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-5 md:px-10">
        <Link
          href="/"
          className="text-[22px] font-bold tracking-[-0.5px] transition-opacity hover:opacity-75"
        >
          lh222k
        </Link>

        <nav className="hidden justify-self-center md:flex md:items-center md:gap-10">
          {TABS.map((tab) => (
            <ProductTabLink
              key={tab.href}
              tab={tab}
              active={isActive(tab.href)}
              className="py-6 text-base"
            />
          ))}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <ThemeToggle />
          <AuthHeader />
        </div>
      </div>

      <nav className="flex items-center gap-6 overflow-x-auto px-5 pb-0 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <ProductTabLink
            key={tab.href}
            tab={tab}
            active={isActive(tab.href)}
            className="pb-2.5 text-sm"
          />
        ))}
      </nav>
    </header>
  )
}
