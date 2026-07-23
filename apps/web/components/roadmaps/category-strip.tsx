"use client"

import type { ComponentType } from "react"
import {
  BarChart3,
  BrainCircuit,
  Briefcase,
  Cloud,
  Monitor,
  PenTool,
  Shield,
  Smartphone,
  Tag,
  Terminal,
  Users,
} from "lucide-react"
import { useFields } from "@workspace/core"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Icons are cosmetic, so they are matched by slug and fall back to a generic
 * tag. Admins create labels freely — the strip must not break, or silently
 * hide a label, just because nobody mapped an icon for it.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "web-dev": Monitor,
  ai: BrainCircuit,
  design: PenTool,
  business: Briefcase,
  data: BarChart3,
  community: Users,
  mobile: Smartphone,
  devops: Terminal,
  security: Shield,
  cloud: Cloud,
}

/**
 * Horizontally scrollable label tabs under the hero. `null` means "All" — the
 * unfiltered catalogue — and is always the first tab so there is a way back
 * from a filter that matches nothing.
 *
 * Renders nothing when no labels exist: an empty strip is chrome with no
 * function, and the mock backend has no labels at all.
 */
export function CategoryStrip({
  selectedFieldId,
  onSelect,
}: {
  selectedFieldId: string | null
  onSelect: (fieldId: string | null) => void
}) {
  const { fields } = useFields()

  if (fields.length === 0) return null

  return (
    <div className="border-b border-[#ebebeb] dark:border-border">
      <div className="mx-auto flex max-w-[1280px] items-center gap-8 overflow-x-auto px-5 py-3.5 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden">
        <Tab active={selectedFieldId === null} onClick={() => onSelect(null)}>
          All
        </Tab>
        {fields.map((field) => {
          const Icon = ICONS[field.slug] ?? Tag
          return (
            <Tab
              key={field.id}
              active={selectedFieldId === field.id}
              onClick={() => onSelect(field.id)}
            >
              <Icon className="size-[18px]" />
              {field.name}
            </Tab>
          )
        })}
      </div>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative top-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
