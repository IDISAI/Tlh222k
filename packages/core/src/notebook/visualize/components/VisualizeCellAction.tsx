"use client"

import { Eye } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import type { VisualizeAvailability } from "../availability"

/**
 * The per-cell "Visualize execution" action. Shared by the web viewer cell and
 * the admin editor cell so both surfaces expose the same control, label, and
 * disabled/coming-soon behavior.
 */
export function VisualizeCellAction({
  availability,
  onVisualize,
}: {
  /** "ready" = clickable, "coming-soon" = disabled, "hidden" = renders nothing. */
  availability: VisualizeAvailability
  onVisualize?: () => void
}) {
  if (availability === "hidden") return null
  const comingSoon = availability === "coming-soon"
  return (
    <div className="mt-1.5 flex justify-end">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={comingSoon}
        title={comingSoon ? "Coming soon for this language" : undefined}
        onClick={onVisualize}
      >
        <Eye className="size-3.5" /> Visualize execution
      </Button>
    </div>
  )
}
