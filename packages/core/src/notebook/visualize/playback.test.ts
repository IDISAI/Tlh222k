import { describe, expect, it } from "vitest"

import {
  initialPlayback,
  playbackDelayMs,
  playbackReducer,
  type PlaybackState,
} from "./playback"

const three = (over: Partial<PlaybackState> = {}): PlaybackState => ({
  ...initialPlayback(3),
  ...over,
})

describe("playbackReducer", () => {
  it("clamps an empty trace to cursor 0 and never plays", () => {
    const empty = initialPlayback(0)
    expect(playbackReducer(empty, { type: "next" }).cursor).toBe(0)
    expect(playbackReducer(empty, { type: "last" }).cursor).toBe(0)
    expect(playbackReducer(empty, { type: "toggle" }).playing).toBe(false)
  })

  it("never plays a single-step trace", () => {
    expect(playbackReducer(initialPlayback(1), { type: "toggle" }).playing).toBe(false)
  })

  it("clamps first/previous/next/last", () => {
    expect(playbackReducer(three({ cursor: 2 }), { type: "first" }).cursor).toBe(0)
    expect(playbackReducer(three({ cursor: 0 }), { type: "previous" }).cursor).toBe(0)
    expect(playbackReducer(three({ cursor: 1 }), { type: "previous" }).cursor).toBe(0)
    expect(playbackReducer(three({ cursor: 2 }), { type: "next" }).cursor).toBe(2)
    expect(playbackReducer(three({ cursor: 0 }), { type: "last" })).toEqual(
      three({ cursor: 2, playing: false })
    )
  })

  it("stops playback on manual jumps", () => {
    expect(playbackReducer(three({ playing: true }), { type: "next" }).playing).toBe(false)
    expect(playbackReducer(three({ playing: true, cursor: 2 }), { type: "first" }).playing).toBe(false)
  })

  it("toggle starts only when another step exists", () => {
    expect(playbackReducer(three({ cursor: 0 }), { type: "toggle" }).playing).toBe(true)
    const restarted = playbackReducer(three({ cursor: 2 }), { type: "toggle" })
    expect(restarted).toMatchObject({ cursor: 0, playing: true })
  })

  it("toggle pauses when playing", () => {
    expect(playbackReducer(three({ playing: true }), { type: "toggle" }).playing).toBe(false)
  })

  it("tick advances and stops at the final step", () => {
    const mid = playbackReducer(three({ playing: true, cursor: 0 }), { type: "tick" })
    expect(mid).toMatchObject({ cursor: 1, playing: true })
    const end = playbackReducer(three({ playing: true, cursor: 1 }), { type: "tick" })
    expect(end).toMatchObject({ cursor: 2, playing: false })
  })

  it("tick is a no-op when paused", () => {
    expect(playbackReducer(three({ cursor: 1 }), { type: "tick" }).cursor).toBe(1)
  })

  it("setSpeed keeps cursor and playing", () => {
    const next = playbackReducer(three({ cursor: 1, playing: true }), {
      type: "setSpeed",
      speed: 2,
    })
    expect(next).toMatchObject({ cursor: 1, playing: true, speed: 2 })
  })

  it("load resets cursor and playback for a new trace", () => {
    const loaded = playbackReducer(three({ cursor: 2, playing: true, speed: 2 }), {
      type: "load",
      stepCount: 5,
    })
    expect(loaded).toEqual({ cursor: 0, playing: false, speed: 1, stepCount: 5 })
  })
})

describe("playbackDelayMs", () => {
  it("maps speeds to intervals", () => {
    expect(playbackDelayMs(0.5)).toBe(1200)
    expect(playbackDelayMs(1)).toBe(600)
    expect(playbackDelayMs(2)).toBe(300)
  })
})
