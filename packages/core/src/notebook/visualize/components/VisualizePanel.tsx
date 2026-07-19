"use client"

import { useEffect, useReducer } from "react"
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import {
  initialPlayback,
  PLAYBACK_SPEEDS,
  playbackDelayMs,
  playbackReducer,
  type PlaybackSpeed,
} from "../playback"
import type { TraceResult, TraceValue } from "../types"

export interface VisualizePanelProps {
  /** Source that produced the trace; rendered as the annotated line list. */
  source: string
  /** null = no engine produced a trace (C3/C4 register engines). */
  trace: TraceResult | null
  loading?: boolean
  onClose: () => void
}

/**
 * Language-agnostic trace playback shell (C2): annotated source, step
 * controls, variables/stack/heap/output sections. Engines feed it a
 * `TraceResult`; it never executes code itself.
 */
export function VisualizePanel({ source, trace, loading, onClose }: VisualizePanelProps) {
  const steps = trace?.steps ?? []
  const [playback, dispatch] = useReducer(playbackReducer, initialPlayback(steps.length))

  // New trace: reset cursor/playback to its first step.
  useEffect(() => {
    dispatch({ type: "load", stepCount: trace?.steps.length ?? 0 })
  }, [trace])

  // Timer lives here, not in the reducer; reducer ends playback at the last
  // step, which tears the interval down via this dependency.
  useEffect(() => {
    if (!playback.playing) return
    const timer = setInterval(
      () => dispatch({ type: "tick" }),
      playbackDelayMs(playback.speed)
    )
    return () => clearInterval(timer)
  }, [playback.playing, playback.speed])

  const step = steps[playback.cursor]
  const atStart = playback.cursor === 0
  const atEnd = steps.length === 0 || playback.cursor === steps.length - 1
  // Innermost frame carries the "current" locals.
  const currentFrame = step?.frames[step.frames.length - 1]

  return (
    <section
      aria-label="Execution visualization"
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-3 text-sm"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Visualize execution</h2>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Close visualization"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      {loading ? (
        <p role="status" className="text-muted-foreground">
          Preparing trace…
        </p>
      ) : !trace ? (
        <p role="status" className="text-muted-foreground">
          Trace engine for this language is not available yet.
        </p>
      ) : (
        <>
          {trace.error && (
            <p
              role="status"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive"
            >
              {trace.error.name}: {trace.error.message}
              {trace.error.line !== undefined && ` (line ${trace.error.line})`}
            </p>
          )}
          {trace.truncated && (
            <p
              role="status"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-400"
            >
              Trace truncated: step limit reached. Showing collected steps.
            </p>
          )}

          {/* Annotated source: full-width highlight + arrow on current line */}
          <ol aria-label="Source lines" className="rounded-md border bg-muted/40 py-1 font-mono text-xs">
            {source.split("\n").map((text, i) => {
              const current = step !== undefined && step.line === i + 1
              return (
                <li
                  key={i}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex gap-2 whitespace-pre px-2",
                    current && "bg-primary/15 text-foreground"
                  )}
                >
                  <span aria-hidden className="w-3 shrink-0 text-primary">
                    {current ? "→" : ""}
                  </span>
                  <span className="w-6 shrink-0 select-none text-right text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 overflow-x-auto">{text || " "}</span>
                </li>
              )
            })}
          </ol>

          {/* Playback controls */}
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="First step"
              disabled={atStart}
              onClick={() => dispatch({ type: "first" })}
            >
              <ChevronFirst className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Previous step"
              disabled={atStart}
              onClick={() => dispatch({ type: "previous" })}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={playback.playing ? "Pause" : "Play"}
              disabled={steps.length < 2}
              onClick={() => dispatch({ type: "toggle" })}
            >
              {playback.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Next step"
              disabled={atEnd}
              onClick={() => dispatch({ type: "next" })}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Last step"
              disabled={atEnd}
              onClick={() => dispatch({ type: "last" })}
            >
              <ChevronLast className="size-4" />
            </Button>
            <label className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
              Speed
              <select
                className="rounded-md border bg-background px-1 py-0.5"
                value={String(playback.speed)}
                onChange={(event) =>
                  dispatch({
                    type: "setSpeed",
                    speed: Number(event.target.value) as PlaybackSpeed,
                  })
                }
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <option key={speed} value={String(speed)}>
                    {speed}×
                  </option>
                ))}
              </select>
            </label>
            <span aria-live="polite" className="ml-auto text-xs text-muted-foreground">
              {steps.length === 0
                ? "No steps"
                : `Step ${playback.cursor + 1} of ${steps.length}`}
            </span>
          </div>

          {steps.length === 0 ? (
            <p role="status" className="text-muted-foreground">
              No steps recorded.
            </p>
          ) : (
            <>
              <PanelSection title="Variables">
                {currentFrame && Object.keys(currentFrame.locals).length > 0 ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
                    {Object.entries(currentFrame.locals).map(([name, value]) => (
                      <div key={name} className="contents">
                        <dt className="text-muted-foreground">{name}</dt>
                        <dd>{renderValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">No variables yet.</p>
                )}
              </PanelSection>

              <PanelSection title="Stack">
                <ol className="space-y-0.5 font-mono text-xs">
                  {step!.frames.map((frame) => (
                    <li key={frame.id}>
                      {frame.name}{" "}
                      <span className="text-muted-foreground">line {frame.line}</span>
                    </li>
                  ))}
                </ol>
              </PanelSection>

              <PanelSection title="Heap">
                {step!.heap.length > 0 ? (
                  <ul className="space-y-1 font-mono text-xs">
                    {step!.heap.map((node) => (
                      <li key={node.id} className="rounded-md border bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">{node.id}</span> {node.type}
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
                          {Object.entries(node.fields).map(([field, value]) => (
                            <div key={field} className="contents">
                              <dt className="text-muted-foreground">{field}</dt>
                              <dd>{renderValue(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Heap is empty.</p>
                )}
              </PanelSection>

              <PanelSection title="Output">
                {step!.stdout.length > 0 ? (
                  <pre className="overflow-x-auto rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs">
                    {step!.stdout.join("\n")}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">No output yet.</p>
                )}
              </PanelSection>
            </>
          )}
        </>
      )}
    </section>
  )
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function renderValue(value: TraceValue): string {
  switch (value.kind) {
    case "primitive":
      return typeof value.value === "string" ? JSON.stringify(value.value) : String(value.value)
    case "reference":
      // Textual reference for C2; SVG arrows arrive with the C3 heap renderer.
      return `${value.label} → ${value.id}`
    case "truncated":
      return value.preview
  }
}
