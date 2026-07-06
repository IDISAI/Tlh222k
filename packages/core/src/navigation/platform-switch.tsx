import type { FC } from "react"

import type { UserRole } from "./types"

// One domain, path-based zones (Next.js Multi-Zones). Root-absolute hrefs +
// plain <a> so navigation crosses zones correctly (Link/basePath would rewrite).
const platforms = [
  { key: "web", label: "Web", href: "/" },
  { key: "admin", label: "Admin", href: "/admin" },
  { key: "super-admin", label: "Super Admin", href: "/super-admin" },
] as const

export type PlatformKey = (typeof platforms)[number]["key"]

/**
 * Zones a role is allowed to see (Req 5.1–5.3, Property 6).
 * Enforces Role Monotonicity (A1): super-admin ⊇ admin ⊇ viewer.
 * `undefined` (guest / viewer) → only "web".
 */
export function getAllowedPlatforms(role?: UserRole): PlatformKey[] {
  if (role === "super-admin") return ["web", "admin", "super-admin"]
  if (role === "admin") return ["web", "admin"]
  return ["web"]
}

export const PlatformSwitch: FC<{ current?: PlatformKey; role?: UserRole }> = ({
  current,
  role,
}) => {
  const allowed = getAllowedPlatforms(role)
  const visible = platforms.filter((p) => allowed.includes(p.key))

  // Invalid `current` (outside the union) → warn, leave nothing active (Req 6.5).
  if (current && !platforms.some((p) => p.key === current)) {
    console.warn(`[PlatformSwitch] invalid "current" prop: "${current}"`)
  }

  return (
    <nav className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
      {visible.map((p) => {
        const active = p.key === current
        return (
          <a
            key={p.key}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-md px-3 py-1 transition-colors " +
              (active
                ? "bg-background font-bold text-foreground underline underline-offset-4 shadow-sm"
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
