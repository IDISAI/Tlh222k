import { describe, expect, it } from "vitest"

import { inspectUpload } from "./upload-policy"

describe("inspectUpload", () => {
  it.each([
    "image/svg+xml",
    "text/html",
    "application/x-msdownload",
    "application/zip",
  ])("rejects %s", (type) => {
    expect(inspectUpload({ name: "unsafe.bin", size: 10, type })).toEqual({
      ok: false,
      code: "UNSUPPORTED_FILE_TYPE",
    })
  })

  it.each([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "text/plain;charset=utf-8",
  ])("allows %s", (type) => {
    expect(
      inspectUpload({ name: "safe file.txt", size: 10, type })
    ).toMatchObject({
      ok: true,
      contentType: type,
    })
  })

  it("sanitizes path traversal and control characters from the filename", () => {
    expect(
      inspectUpload({
        name: "../..\\evil\u0000 report.pdf",
        size: 10,
        type: "application/pdf",
      })
    ).toEqual({
      ok: true,
      contentType: "application/pdf",
      sanitizedName: "evil-report.pdf",
    })
  })

  it("rejects empty and oversized files", () => {
    expect(
      inspectUpload({ name: "a.png", size: 0, type: "image/png" })
    ).toEqual({
      ok: false,
      code: "NO_FILE",
    })
    expect(
      inspectUpload({
        name: "a.png",
        size: 10 * 1024 * 1024 + 1,
        type: "image/png",
      })
    ).toEqual({ ok: false, code: "FILE_TOO_LARGE" })
  })
})
