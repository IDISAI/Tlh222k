"use client"

// Host-side visualization wiring shared by the web viewer and the admin editor.
// Both surfaces own exactly one panel per notebook and one trace engine per
// language per mount; keeping that here is what stops the two from drifting.

import { useCallback, useEffect, useRef, useState } from "react"

import { traceLanguage, visualizeAvailability } from "./availability"
import type { TraceFactory, TraceLanguage, TraceResult } from "./types"
import { WorkerTraceEngine } from "./worker-trace-engine"

/** The slice of a runtime cell the visualization gate reads. */
export interface VisualizationCellState {
  source: string
  lastRunStatus: string
  lastExecutedSource?: string
  /** Bumped by every run; distinguishes a rerun of identical source. */
  executionCount: number | null
}

export interface ActiveVisualization {
  cellId: string
  /** Source snapshot that ran; the panel annotates exactly these lines. */
  source: string
  /** The cell's `executionCount` at the moment this trace was requested. */
  runId: number | null
  trace: TraceResult | null
  loading: boolean
}

export interface VisualizationController {
  active: ActiveVisualization | null
  /** No-op unless the cell currently passes the success/source gate. */
  open: (cellId: string) => void
  /** Re-issues the trace for the open cell (engine failure recovery). */
  retry: () => void
  close: () => void
}

/**
 * Turns a rejected trace into a displayable result. Engine failures must reach
 * the user as the real error plus a retry, never as "engine unavailable".
 */
export function traceErrorResult(
  language: TraceLanguage,
  error: unknown
): TraceResult {
  const cause = error as { name?: unknown; message?: unknown; line?: unknown }
  const name =
    typeof cause?.name === "string" && cause.name ? cause.name : "TraceError"
  const message =
    typeof cause?.message === "string" && cause.message
      ? cause.message
      : String(error)
  const result: TraceResult = {
    language,
    steps: [],
    truncated: false,
    error: { name, message },
  }
  if (typeof cause?.line === "number" && Number.isFinite(cause.line)) {
    result.error!.line = cause.line
  }
  return result
}

export function useVisualization<Cell extends VisualizationCellState>({
  language,
  cells,
  createTrace,
}: {
  /** nbformat language of the notebook, not of an individual cell. */
  language: string | undefined
  cells: Record<string, Cell>
  /** Absent = no engine registered; the panel says so instead of failing. */
  createTrace?: TraceFactory
}): VisualizationController {
  const [active, setActive] = useState<ActiveVisualization | null>(null)
  // Monotonic token: a late-resolving trace only lands while it is still the
  // request the user is waiting on (open A, open B, A resolves afterwards).
  // Only ever written from callbacks, never during render.
  const token = useRef(0)
  // Navigating away mid-trace resolves the promise after unmount; landing it
  // then is a React warning and a pointless render.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const request = useCallback(
    (cellId: string, source: string, runId: number | null) => {
      const engineLanguage = traceLanguage(language)
      const issued = ++token.current
      const landed = () => mounted.current && token.current === issued
      if (!createTrace || !engineLanguage) {
        setActive({ cellId, source, runId, trace: null, loading: false })
        return
      }
      setActive({ cellId, source, runId, trace: null, loading: true })
      createTrace({ language: engineLanguage, source }).then(
        (trace) => {
          if (landed())
            setActive({ cellId, source, runId, trace, loading: false })
        },
        (error: unknown) => {
          if (landed())
            setActive({
              cellId,
              source,
              runId,
              trace: traceErrorResult(engineLanguage, error),
              loading: false,
            })
        }
      )
    },
    [createTrace, language]
  )

  const open = useCallback(
    (cellId: string) => {
      const cell = cells[cellId]
      // Rechecked here, not only through a hidden/disabled button: the button
      // is not the boundary for what the engine is allowed to run.
      if (!cell || visualizeAvailability(language, cell) !== "ready") return
      request(
        cellId,
        cell.lastExecutedSource ?? cell.source,
        cell.executionCount
      )
    },
    [cells, language, request]
  )

  // An open trace is a claim about a source that ran. Editing that source,
  // rerunning it, restarting the kernel, or swapping notebooks all withdraw the
  // claim, so freshness is derived on every render rather than stored.
  const cell = active ? cells[active.cellId] : undefined
  const fresh =
    active !== null &&
    cell !== undefined &&
    cell.source === active.source &&
    cell.lastExecutedSource === active.source &&
    cell.lastRunStatus === "success" &&
    cell.executionCount === active.runId
      ? active
      : null

  const retry = useCallback(() => {
    if (fresh) request(fresh.cellId, fresh.source, fresh.runId)
  }, [fresh, request])

  const close = useCallback(() => {
    token.current++
    setActive(null)
  }, [])

  return { active: fresh, open, retry, close }
}

/**
 * One lazily created trace worker per language, per notebook mount, terminated
 * on unmount. The worker is only constructed on the first visualize click, and
 * survives panel close/switch so a shared or pending request is never killed.
 *
 * `createWorker` must live in the app: only the app's bundler can resolve a
 * `new Worker(new URL(...), import.meta.url)` entrypoint.
 */
export function useTraceEngines(
  createWorker: (language: TraceLanguage) => Worker
): TraceFactory {
  // Captured once: a worker entrypoint is a static per-app module function, and
  // rebinding it mid-mount would orphan already-running workers.
  const factory = useRef(createWorker)
  const engines = useRef<Partial<Record<TraceLanguage, WorkerTraceEngine>>>({})

  useEffect(() => {
    const created = engines.current
    return () => {
      for (const engine of Object.values(created)) engine.dispose()
      engines.current = {}
    }
  }, [])

  return useCallback((request) => {
    const engine = (engines.current[request.language] ??= new WorkerTraceEngine(
      () => factory.current(request.language)
    ))
    return engine.trace(request)
  }, [])
}
