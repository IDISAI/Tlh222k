// Shared execution-trace presentation contract (C2). Language engines (C3
// Python, C4 JavaScript) must emit exactly this shape; the panel and playback
// code contain no language-specific branches. Everything here must stay
// JSON-cloneable — traces cross a Web Worker boundary via structured clone.

/** Languages that can produce a visualization trace. */
export type TraceLanguage = "python" | "javascript"

/** Hard caps engines must enforce; the schema is not valid beyond them. */
export const TRACE_LIMITS = {
  maxSteps: 3000,
  maxDepth: 3,
  maxStringLength: 100,
} as const

export type TracePrimitive = string | number | boolean | null

export type TraceValue =
  | { kind: "primitive"; value: TracePrimitive }
  /** Points at a `TraceHeapNode.id`; `label` is the short inline text (e.g. "list"). */
  | { kind: "reference"; id: string; label: string }
  /** Value elided by depth/length caps; `preview` is the display text. */
  | { kind: "truncated"; preview: string }

export interface TraceFrame {
  /** Stable within one trace (call sites can repeat a function name). */
  id: string
  name: string
  /** 1-based line currently executing in this frame. */
  line: number
  locals: Record<string, TraceValue>
}

export interface TraceHeapNode {
  /** Stable within one trace; referenced from `TraceValue.reference`. */
  id: string
  /** Display type, e.g. "list", "dict", "Array", "Object". */
  type: string
  fields: Record<string, TraceValue>
}

export interface TraceStep {
  /** 0-based position in `TraceResult.steps`. */
  index: number
  /** 1-based source line about to execute (or where the event fired). */
  line: number
  event: "call" | "line" | "return" | "exception"
  /** Innermost frame last; empty only for module-level bookkeeping steps. */
  frames: TraceFrame[]
  heap: TraceHeapNode[]
  /** Cumulative stdout lines emitted up to and including this step. */
  stdout: string[]
}

export interface TraceResult {
  language: TraceLanguage
  steps: TraceStep[]
  /** True when the engine stopped at `TRACE_LIMITS.maxSteps`. */
  truncated: boolean
  error?: { name: string; message: string; line?: number }
}

/**
 * Engine seam: hosts inject one of these to enable visualization. Until C3/C4
 * register real engines, the default host has none and the panel reports
 * "unavailable". Kept async so worker-backed engines fit without a change.
 */
export type TraceFactory = (request: {
  language: TraceLanguage
  source: string
}) => Promise<TraceResult>
