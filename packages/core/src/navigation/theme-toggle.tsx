"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

// Icon shown via `dark:` classes (not JS) so there's no hydration mismatch.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  )
}
