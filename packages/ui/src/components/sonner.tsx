"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme ?? "system") as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

// Re-export the imperative API so consumers only depend on @workspace/ui.
export { Toaster, toast }
