import { describe, expect, it } from "vitest"

import { inspectFieldImage } from "./field-image-policy"

describe("inspectFieldImage", () => {
  it("accepts a 3:2 JPEG that meets Explorer requirements", () => {
    expect(inspectFieldImage({ name: "cover.jpg", type: "image/jpeg", size: 1_000_000, width: 2400, height: 1600 })).toMatchObject({ ok: true, contentType: "image/jpeg" })
  })

  it("rejects wrong dimensions and unsupported types", () => {
    expect(inspectFieldImage({ name: "cover.png", type: "image/png", size: 1_000, width: 2400, height: 1600 })).toEqual({ ok: false, code: "UNSUPPORTED_FILE_TYPE" })
    expect(inspectFieldImage({ name: "cover.webp", type: "image/webp", size: 1_000, width: 2000, height: 1600 })).toEqual({ ok: false, code: "INVALID_DIMENSIONS" })
  })
})
