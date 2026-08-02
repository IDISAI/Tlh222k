import { describe, expect, it } from "vitest"

import { inspectFieldImage } from "./field-image-policy"

describe("inspectFieldImage", () => {
  it("accepts a JPEG regardless of dimensions or aspect ratio", () => {
    expect(inspectFieldImage({ name: "cover.jpg", type: "image/jpeg", size: 1_000_000, width: 640, height: 480 })).toMatchObject({ ok: true, contentType: "image/jpeg" })
  })

  it("rejects unsupported types", () => {
    expect(inspectFieldImage({ name: "cover.png", type: "image/png", size: 1_000, width: 2400, height: 1600 })).toEqual({ ok: false, code: "UNSUPPORTED_FILE_TYPE" })
  })

  it("rejects an oversized file", () => {
    expect(inspectFieldImage({ name: "cover.jpg", type: "image/jpeg", size: 3_000_000, width: 2400, height: 1600 })).toEqual({ ok: false, code: "FILE_TOO_LARGE" })
  })
})
