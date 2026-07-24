import { languageSpec } from "../kernel/languages"
import type { TraceLanguage } from "./types"

/**
 * Whether a cell can offer "Visualize execution":
 * - `ready`: traceable language and the current source is the source that
 *   last ran successfully;
 * - `coming-soon`: known language without a trace engine (disabled action);
 * - `hidden`: unknown language, never ran, failed, or edited since the run.
 */
export type VisualizeAvailability = "hidden" | "ready" | "coming-soon"

/** Languages with a trace engine (C3 Python, C4 JavaScript). */
export function traceLanguage(language: string | undefined): TraceLanguage | null {
  const name = languageSpec(language)?.language
  return name === "python" || name === "javascript" ? name : null
}

export function visualizeAvailability(
  language: string | undefined,
  cell: { source: string; lastRunStatus: string; lastExecutedSource?: string }
): VisualizeAvailability {
  const spec = languageSpec(language)
  if (!spec) return "hidden"
  if (!traceLanguage(language)) return "coming-soon"
  return cell.lastRunStatus === "success" && cell.lastExecutedSource === cell.source
    ? "ready"
    : "hidden"
}
