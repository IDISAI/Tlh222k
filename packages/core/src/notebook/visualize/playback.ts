// Pure playback state for trace stepping. Timer ownership stays in the panel
// component — the reducer only answers "what happens on tick/toggle/jump".

export type PlaybackSpeed = 0.5 | 1 | 2

export interface PlaybackState {
  /** Index into `TraceResult.steps`; always clamped to [0, stepCount - 1]. */
  cursor: number
  playing: boolean
  speed: PlaybackSpeed
  /** Total steps of the loaded trace; 0 = nothing loaded. */
  stepCount: number
}

export type PlaybackAction =
  | { type: "first" }
  | { type: "previous" }
  | { type: "next" }
  | { type: "last" }
  /** Play/pause toggle; starts only when another step exists ahead. */
  | { type: "toggle" }
  /** Timer advance; stops playback on the final step. */
  | { type: "tick" }
  | { type: "setSpeed"; speed: PlaybackSpeed }
  /** New trace loaded: reset cursor and stop playback. */
  | { type: "load"; stepCount: number }

export function initialPlayback(stepCount = 0): PlaybackState {
  return { cursor: 0, playing: false, speed: 1, stepCount: Math.max(0, stepCount) }
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  const lastIndex = Math.max(0, state.stepCount - 1)
  switch (action.type) {
    case "first":
      return { ...state, cursor: 0, playing: false }
    case "previous":
      return { ...state, cursor: Math.max(0, state.cursor - 1), playing: false }
    case "next":
      return { ...state, cursor: Math.min(lastIndex, state.cursor + 1), playing: false }
    case "last":
      return { ...state, cursor: lastIndex, playing: false }
    case "toggle": {
      if (state.playing) return { ...state, playing: false }
      // Play from the start when toggled at the end; never play an empty trace.
      if (state.stepCount < 2) return state
      if (state.cursor >= lastIndex) return { ...state, cursor: 0, playing: true }
      return { ...state, playing: true }
    }
    case "tick": {
      if (!state.playing) return state
      const cursor = Math.min(lastIndex, state.cursor + 1)
      return { ...state, cursor, playing: cursor < lastIndex }
    }
    case "setSpeed":
      return { ...state, speed: action.speed }
    case "load":
      return initialPlayback(action.stepCount)
    default:
      return state
  }
}

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2]

/** Interval between auto-advance ticks for a speed. */
export function playbackDelayMs(speed: PlaybackSpeed): number {
  switch (speed) {
    case 0.5:
      return 1200
    case 2:
      return 300
    default:
      return 600
  }
}
