"use client"

// Python-Tutor-style memory diagram: stack frames on the left, heap objects on
// the right, and a real drawn arrow from every reference slot to the object it
// points at. Language-agnostic — it renders TraceStep, so Python and JavaScript
// share one renderer.

import { useCallback, useLayoutEffect, useRef, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import type { TraceStep, TraceValue } from "../types"

/** One slot → one heap object. `slot` is unique within a step. */
interface Edge {
  slot: string
  target: string
}

interface Arrow extends Edge {
  path: string
}

/** Horizontal control-point offset; enough to read the curve at panel width. */
const CURVE = 36
/** How far a self-reference loop bulges to the right of its own box. */
const SELF_LOOP = 26

export function MemoryDiagram({ step }: { step: TraceStep }) {
  const container = useRef<HTMLDivElement>(null)
  const slots = useRef(new Map<string, HTMLElement>())
  const boxes = useRef(new Map<string, HTMLElement>())
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })

  const edges = collectEdges(step)
  // Identity of the edge set: recompute geometry when the step's shape changes,
  // not on every render.
  const shape = edges.map((edge) => `${edge.slot}>${edge.target}`).join("|")

  const measure = useCallback(() => {
    const root = container.current
    if (!root) return
    const origin = root.getBoundingClientRect()
    const next: Arrow[] = []
    for (const edge of edges) {
      const from = slots.current.get(edge.slot)
      const to = boxes.current.get(edge.target)
      if (!from || !to) continue
      const a = from.getBoundingClientRect()
      const b = to.getBoundingClientRect()
      const dx = root.scrollLeft - origin.left
      const dy = root.scrollTop - origin.top
      const start = { x: a.right + dx, y: a.top + a.height / 2 + dy }
      const entryY = b.top + Math.min(14, b.height / 2) + dy
      // Entering the target's left edge only works when it actually sits to the
      // right. Otherwise (same column, or the object above its own pointer) the
      // curve would cut back across the box it started from, so loop around the
      // right-hand side and come in from there instead.
      const leftEntry = b.left + dx
      if (leftEntry > start.x + 8) {
        next.push({ ...edge, path: sweep(start, { x: leftEntry, y: entryY }) })
        continue
      }
      const rightEntry = b.right + dx
      const detour = Math.max(start.x, rightEntry) + SELF_LOOP
      next.push({
        ...edge,
        path: loop(start, { x: rightEntry, y: entryY }, detour),
      })
    }
    setArrows(next)
    setSize({ width: root.scrollWidth, height: root.scrollHeight })
  }, [edges])

  useLayoutEffect(() => {
    measure()
    const root = container.current
    if (!root || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
    // `shape` stands in for `edges`, which is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, step.index])

  const registerSlot = (key: string) => (el: HTMLElement | null) => {
    if (el) slots.current.set(key, el)
    else slots.current.delete(key)
  }
  const registerBox = (key: string) => (el: HTMLElement | null) => {
    if (el) boxes.current.set(key, el)
    else boxes.current.delete(key)
  }

  return (
    <div
      ref={container}
      aria-label="Memory diagram"
      className="relative overflow-x-auto"
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        width={size.width || "100%"}
        height={size.height || "100%"}
      >
        <defs>
          <marker
            id="trace-arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" className="fill-primary" />
          </marker>
        </defs>
        {arrows.map((arrow) => (
          <path
            key={arrow.slot}
            data-from={arrow.slot}
            data-to={arrow.target}
            d={arrow.path}
            fill="none"
            markerEnd="url(#trace-arrowhead)"
            className="stroke-primary/70"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      {/* pr leaves room for arrows that loop around the right-hand side, which
          the container's overflow-x would otherwise clip. */}
      <div className="relative flex min-w-max gap-8 pr-10">
        <section aria-label="Frames" className="flex flex-col gap-2">
          <ColumnTitle>Frames</ColumnTitle>
          {step.frames.map((frame, index) => (
            <Box
              key={frame.id}
              title={`${frame.name} · line ${frame.line}`}
              current={index === step.frames.length - 1}
            >
              {Object.entries(frame.locals).map(([name, value]) => (
                <Slot
                  key={name}
                  label={name}
                  value={value}
                  anchor={registerSlot(slotKey("frame", frame.id, name))}
                />
              ))}
              {Object.keys(frame.locals).length === 0 && <EmptyRow />}
            </Box>
          ))}
        </section>

        <section aria-label="Objects" className="flex flex-col gap-2">
          <ColumnTitle>Objects</ColumnTitle>
          {step.heap.map((node) => (
            <Box
              key={node.id}
              ref={registerBox(node.id)}
              title={node.type}
              subtitle={node.id}
            >
              {Object.entries(node.fields).map(([field, value]) => (
                <Slot
                  key={field}
                  label={field}
                  value={value}
                  anchor={registerSlot(slotKey("heap", node.id, field))}
                />
              ))}
              {Object.keys(node.fields).length === 0 && <EmptyRow />}
            </Box>
          ))}
          {step.heap.length === 0 && (
            <p className="text-xs text-muted-foreground">No objects yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

function Box({
  ref,
  title,
  subtitle,
  current,
  children,
}: {
  ref?: (el: HTMLElement | null) => void
  title: string
  subtitle?: string
  /** The innermost frame — where execution is right now. */
  current?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "min-w-36 rounded-md border bg-background",
        current ? "border-primary/60 ring-1 ring-primary/20" : "bg-muted/30"
      )}
    >
      <div className="flex items-baseline gap-1 border-b px-2 py-1 font-mono text-xs">
        <span className="font-semibold">{title}</span>
        {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
      </div>
      <dl className="divide-y">{children}</dl>
    </div>
  )
}

function Slot({
  label,
  value,
  anchor,
}: {
  label: string
  value: TraceValue
  anchor: (el: HTMLElement | null) => void
}) {
  const isReference = value.kind === "reference"
  return (
    <div className="flex items-center gap-2 px-2 py-0.5 font-mono text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd ref={anchor} className="ml-auto flex items-center gap-1">
        {isReference ? (
          <>
            <span className="text-muted-foreground">{value.label}</span>
            {/* Arrow tail: the SVG path starts at this element's right edge. */}
            <span
              aria-label={`points to ${value.id}`}
              className="size-1.5 rounded-full bg-primary"
            />
          </>
        ) : (
          <span>{renderValue(value)}</span>
        )}
      </dd>
    </div>
  )
}

function EmptyRow() {
  return (
    <p className="px-2 py-0.5 font-mono text-xs text-muted-foreground">empty</p>
  )
}

function slotKey(kind: "frame" | "heap", owner: string, field: string): string {
  return `${kind}:${owner}:${field}`
}

function collectEdges(step: TraceStep): Edge[] {
  const edges: Edge[] = []
  const known = new Set(step.heap.map((node) => node.id))
  for (const frame of step.frames) {
    for (const [name, value] of Object.entries(frame.locals)) {
      if (value.kind === "reference" && known.has(value.id)) {
        edges.push({ slot: slotKey("frame", frame.id, name), target: value.id })
      }
    }
  }
  for (const node of step.heap) {
    for (const [field, value] of Object.entries(node.fields)) {
      if (value.kind === "reference" && known.has(value.id)) {
        edges.push({ slot: slotKey("heap", node.id, field), target: value.id })
      }
    }
  }
  return edges
}

type Point = { x: number; y: number }

/** Left-to-right arrow: frame slot into an object's left edge. */
function sweep(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} C ${start.x + CURVE} ${start.y}, ${end.x - CURVE} ${end.y}, ${end.x} ${end.y}`
}

/** Arrow that loops around the right-hand side; also covers self-references. */
function loop(start: Point, end: Point, detour: number): string {
  return `M ${start.x} ${start.y} C ${detour} ${start.y}, ${detour} ${end.y}, ${end.x} ${end.y}`
}

/** Non-reference values render inline; references become arrows instead. */
export function renderValue(value: TraceValue): string {
  switch (value.kind) {
    case "primitive":
      return typeof value.value === "string"
        ? JSON.stringify(value.value)
        : String(value.value)
    case "reference":
      return `${value.label} → ${value.id}`
    case "truncated":
      return value.preview
  }
}
