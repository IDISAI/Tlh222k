import type { FC } from "react"

// One domain, path-based zones (Next.js Multi-Zones). Root-absolute hrefs +
// plain <a> so navigation crosses zones correctly (Link/basePath would rewrite).
const platforms = [
  { key: "web", label: "Web", href: "/" },
  { key: "admin", label: "Admin", href: "/admin" },
  { key: "super-admin", label: "Super Admin", href: "/super-admin" },
] as const

export type PlatformKey = (typeof platforms)[number]["key"]

export const PlatformSwitch: FC<{ current?: PlatformKey }> = ({ current }) => {
  return (
    <nav className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
      {platforms.map((p) => {
        const active = p.key === current
        return (
          <a
            key={p.key}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-md px-3 py-1 transition-colors " +
              (active
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {p.label}
          </a>
        )
      })}
    </nav>
  )
}
