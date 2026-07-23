import type { TraceLanguage, TraceResult } from "./types"

export interface TraceRequest {
  language: TraceLanguage
  source: string
}

export interface TraceEngine {
  trace(request: TraceRequest): Promise<TraceResult>
  dispose(): void
}
