"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Plus, X } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { RoadmapService } from "../../api"
import type { CallerRole, Field } from "../../types"
import { serviceErrorMessage } from "../utils/toast-messages"

/** Case- and accent-insensitive so "lập trình" matches "Lap Trinh". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

interface FieldPickerProps {
  /**
   * Passed straight to the service. NOT a security boundary — the real backend
   * derives the caller from the Clerk token and ignores this, so it defaults to
   * `admin` for call sites (canvas panels) that don't thread a role down. Only
   * the mock service reads it, and the mock refuses label writes anyway.
   */
  role?: CallerRole
  /** Selected label ids. A block may carry several. */
  value: string[]
  onChange: (fieldIds: string[]) => void
  disabled?: boolean
}

/**
 * Notion-style creatable multi-select for discovery labels.
 *
 * Typing filters the existing labels; the "create" row only appears when
 * nothing matches EXACTLY. That ordering is the whole point — offering
 * "create" next to an exact match is how a label list silently accumulates
 * "AI" / "ai" / "A.I." variants that then split the tab strip.
 */
export function FieldPicker({
  role = "admin",
  value,
  onChange,
  disabled = false,
}: FieldPickerProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [fields, setFields] = useState<Field[]>([])
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    service
      .listFields()
      .then((next) => {
        if (!cancelled) setFields(next)
      })
      .catch(() => {
        // A label list that won't load must not block creating a roadmap —
        // labels are optional metadata.
        if (!cancelled) setFields([])
      })
    return () => {
      cancelled = true
    }
  }, [service])

  const needle = fold(query)
  const matches = needle
    ? fields.filter((f) => fold(f.name).includes(needle))
    : fields
  const exactExists = fields.some((f) => fold(f.name) === needle)
  const canCreate = needle.length > 0 && !exactExists

  const selected = fields.filter((f) => value.includes(f.id))

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const handleCreate = async () => {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const created = await service.createField(name, role)
      // The server dedupes, so `created` may be a label already in the list.
      setFields((prev) =>
        prev.some((f) => f.id === created.id) ? prev : [...prev, created]
      )
      if (!value.includes(created.id)) onChange([...value, created.id])
      setQuery("")
      inputRef.current?.focus()
    } catch (err) {
      toast.error(serviceErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((field) => (
            <span
              key={field.id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
            >
              {field.name}
              <button
                type="button"
                aria-label={`Bỏ ${field.name}`}
                disabled={disabled}
                onClick={() => toggle(field.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Input
        ref={inputRef}
        value={query}
        disabled={disabled}
        placeholder="Tìm hoặc tạo lĩnh vực…"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return
          // Enter inside a dialog would otherwise submit the whole form.
          e.preventDefault()
          if (canCreate) void handleCreate()
        }}
      />

      <div className="max-h-40 overflow-y-auto rounded-md border">
        {matches.length === 0 && !canCreate ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {fields.length === 0
              ? "Chưa có lĩnh vực nào. Gõ tên để tạo mới."
              : "Không tìm thấy lĩnh vực phù hợp."}
          </p>
        ) : null}

        {matches.map((field) => {
          const isOn = value.includes(field.id)
          return (
            <button
              key={field.id}
              type="button"
              disabled={disabled}
              aria-pressed={isOn}
              onClick={() => toggle(field.id)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                isOn && "font-medium"
              )}
            >
              {field.name}
              {isOn && <Check className="size-4" />}
            </button>
          )
        })}

        {canCreate && (
          <button
            type="button"
            disabled={disabled || creating}
            onClick={() => void handleCreate()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <Plus className="size-4" />
            {creating ? "Đang tạo…" : `Tạo "${query.trim()}"`}
          </button>
        )}
      </div>
    </div>
  )
}
