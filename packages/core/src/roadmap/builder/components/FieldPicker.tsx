"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { RoadmapService } from "../../api"
import type { CallerRole, Field } from "../../types"

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
   * Kept for call-site compatibility. Selection is read-only; backend auth
   * still protects writes in the Field Workspace.
   */
  role?: CallerRole
  /** Selected label ids. A block may carry several. */
  value: string[]
  onChange: (fieldIds: string[]) => void
  disabled?: boolean
}

/** Multi-select for existing discovery labels. Fields are created only in the
 * Field Workspace, so this picker cannot mint an incomplete second record. */
export function FieldPicker({
  value,
  onChange,
  disabled = false,
}: FieldPickerProps) {
  const service = useMemo(() => new RoadmapService(), [])
  const [fields, setFields] = useState<Field[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
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
    ? fields.filter((f) => fold(f.title).includes(needle))
    : fields

  const selected = fields.filter((f) => value.includes(f.id))

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
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
              {field.title}
              <button
                type="button"
                aria-label={`Bỏ ${field.title}`}
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

      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder="Tìm lĩnh vực…"
          aria-expanded={open}
          aria-controls="field-picker-options"
          className="pr-10"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
        />
        <button
          type="button"
          aria-label={open ? "Đóng danh sách lĩnh vực" : "Mở danh sách lĩnh vực"}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && <div id="field-picker-options" className="max-h-40 overflow-y-auto rounded-md border">
        {matches.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {fields.length === 0
              ? "Chưa có lĩnh vực nào. Tạo lĩnh vực trong Workspace trước."
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
              {field.title}
              {isOn && <Check className="size-4" />}
            </button>
          )
        })}

      </div>}
    </div>
  )
}
