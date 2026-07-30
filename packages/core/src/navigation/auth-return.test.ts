import { describe, expect, it } from "vitest"

import {
  authReturnUrl,
  decodeViewport,
  encodeViewport,
  safeReturnUrl,
} from "./auth-return"

describe("authReturnUrl", () => {
  it("keeps the query, which is where the open node lives", () => {
    expect(authReturnUrl("/roadmaps/abc", "?node=n1&at=10,20,1.5")).toBe(
      "/roadmaps/abc?node=n1&at=10,20,1.5"
    )
  })

  it("accepts a search string without its leading question mark", () => {
    expect(authReturnUrl("/roadmaps/abc", "node=n1")).toBe(
      "/roadmaps/abc?node=n1"
    )
  })

  it("drops an empty query rather than leaving a bare ?", () => {
    expect(authReturnUrl("/roadmaps/abc", "?")).toBe("/roadmaps/abc")
    expect(authReturnUrl("/roadmaps/abc")).toBe("/roadmaps/abc")
  })
})

describe("safeReturnUrl", () => {
  it("passes an in-app path", () => {
    expect(safeReturnUrl("/roadmaps/abc?node=n1")).toBe("/roadmaps/abc?node=n1")
  })

  it("refuses anything that could leave this origin", () => {
    expect(safeReturnUrl("//evil.example/x")).toBeNull()
    expect(safeReturnUrl("https://evil.example")).toBeNull()
    expect(safeReturnUrl("\\\\evil.example/x")).toBeNull()
    expect(safeReturnUrl("evil.example")).toBeNull()
    expect(safeReturnUrl(null)).toBeNull()
  })
})

describe("viewport round-trip", () => {
  it("survives encode then decode", () => {
    expect(decodeViewport(encodeViewport({ x: 12.345, y: -8.9, zoom: 1.25 }))).toEqual(
      { x: 12.35, y: -8.9, zoom: 1.25 }
    )
  })

  it("returns null rather than a half-restored camera", () => {
    expect(decodeViewport("10,20")).toBeNull()
    expect(decodeViewport("10,20,abc")).toBeNull()
    expect(decodeViewport("10,20,0")).toBeNull()
    expect(decodeViewport(null)).toBeNull()
  })
})
