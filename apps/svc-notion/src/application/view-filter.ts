// Pure functions applying a view's filter/sort config to database rows.
// ponytail: in-memory over fetched rows — push into SQL/JSONB queries when a
// database outgrows a few thousand rows.
import type { Page, ViewConfig, ViewFilter } from "../domain/entities"

type Props = Record<string, unknown>

const propsOf = (row: Page): Props =>
  (row.properties as Props | null) ?? {}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)

const matches = (row: Page, f: ViewFilter): boolean => {
  const v = propsOf(row)[f.propertyId]
  switch (f.op) {
    case "eq":
      return v === f.value
    case "neq":
      return v !== f.value
    case "contains":
      if (Array.isArray(v)) return v.includes(f.value)
      return String(v ?? "").toLowerCase().includes(String(f.value ?? "").toLowerCase())
    case "empty":
      return isEmpty(v)
    case "notEmpty":
      return !isEmpty(v)
    case "gt":
      return Number(v) > Number(f.value)
    case "lt":
      return Number(v) < Number(f.value)
  }
}

const compare = (a: unknown, b: unknown): number => {
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a ?? "").localeCompare(String(b ?? ""))
}

export function applyView(rows: Page[], config: ViewConfig): Page[] {
  let out = rows
  for (const f of config.filters ?? []) out = out.filter((r) => matches(r, f))
  const sorts = config.sorts ?? []
  if (sorts.length > 0) {
    out = [...out].sort((a, b) => {
      for (const s of sorts) {
        const d = compare(propsOf(a)[s.propertyId], propsOf(b)[s.propertyId])
        if (d !== 0) return s.direction === "desc" ? -d : d
      }
      return 0
    })
  }
  return out
}
