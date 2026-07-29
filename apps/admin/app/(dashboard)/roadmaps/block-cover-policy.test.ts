import { describe, expect, it } from "vitest"

import { inspectBlockCoverImage } from "./block-cover-policy"

describe("inspectBlockCoverImage", () => {
  it("accepts a small JPEG/PNG/WebP regardless of dimensions", () => {
    expect(inspectBlockCoverImage({ name: "cover.jpg", type: "image/jpeg", size: 500_000, width: 640, height: 480 })).toMatchObject({ ok: true, contentType: "image/jpeg" })
    expect(inspectBlockCoverImage({ name: "cover.png", type: "image/png", size: 500_000, width: 640, height: 480 })).toMatchObject({ ok: true, contentType: "image/png" })
  })

  it("enforces no aspect ratio or minimum size", () => {
    expect(inspectBlockCoverImage({ name: "square.webp", type: "image/webp", size: 500_000, width: 400, height: 400 })).toMatchObject({ ok: true })
    expect(inspectBlockCoverImage({ name: "tiny.jpg", type: "image/jpeg", size: 500_000, width: 200, height: 150 })).toMatchObject({ ok: true })
  })

  it("rejects an oversized file", () => {
    expect(inspectBlockCoverImage({ name: "cover.jpg", type: "image/jpeg", size: 4_000_000, width: 640, height: 480 })).toEqual({ ok: false, code: "FILE_TOO_LARGE" })
  })

  it("rejects an unsupported type", () => {
    expect(inspectBlockCoverImage({ name: "cover.gif", type: "image/gif", size: 500_000, width: 640, height: 480 })).toEqual({ ok: false, code: "UNSUPPORTED_FILE_TYPE" })
  })
})
