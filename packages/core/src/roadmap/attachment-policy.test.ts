import { describe, expect, it } from "vitest"

import { inspectAttachment, sanitizeAttachmentName } from "./attachment-policy"

const pdf = {
  name: "bai-tap.pdf",
  size: 500_000,
  type: "application/pdf",
}

describe("inspectAttachment", () => {
  it("accepts the document formats the contract names", () => {
    expect(inspectAttachment(pdf).ok).toBe(true)
    expect(inspectAttachment({ ...pdf, name: "a.png", type: "image/png" }).ok).toBe(true)
    expect(
      inspectAttachment({
        ...pdf,
        name: "a.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).ok
    ).toBe(true)
  })

  it("rejects an empty file", () => {
    expect(inspectAttachment({ ...pdf, size: 0 })).toEqual({
      ok: false,
      code: "NO_FILE",
    })
  })

  it("rejects a file over the size cap", () => {
    expect(inspectAttachment({ ...pdf, size: 51 * 1024 * 1024 })).toEqual({
      ok: false,
      code: "FILE_TOO_LARGE",
    })
  })

  it("rejects an executable by its MIME type", () => {
    expect(
      inspectAttachment({ name: "setup.pdf", size: 1000, type: "application/x-msdownload" })
    ).toEqual({ ok: false, code: "EXECUTABLE_REJECTED" })
  })

  it("rejects an executable by its extension even when the MIME lies", () => {
    // A browser reports whatever the OS guesses, and an attacker sets it
    // outright. Checking only the MIME lets `payload.exe` through as a PDF.
    expect(
      inspectAttachment({ name: "payload.exe", size: 1000, type: "application/pdf" })
    ).toEqual({ ok: false, code: "EXECUTABLE_REJECTED" })
    expect(
      inspectAttachment({ name: "run.BAT", size: 1000, type: "application/pdf" })
    ).toEqual({ ok: false, code: "EXECUTABLE_REJECTED" })
    expect(
      inspectAttachment({ name: "s.sh", size: 1000, type: "text/plain" })
    ).toEqual({ ok: false, code: "EXECUTABLE_REJECTED" })
  })

  it("rejects a double extension that hides the real one", () => {
    // "report.pdf.exe" opens as an executable but reads as a PDF in a list.
    expect(
      inspectAttachment({ name: "report.pdf.exe", size: 1000, type: "application/pdf" })
    ).toEqual({ ok: false, code: "EXECUTABLE_REJECTED" })
  })

  it("rejects a type that is neither image, PDF, nor office document", () => {
    expect(
      inspectAttachment({ name: "data.zip", size: 1000, type: "application/zip" })
    ).toEqual({ ok: false, code: "UNSUPPORTED_FILE_TYPE" })
  })
})

describe("sanitizeAttachmentName", () => {
  it("keeps a plain name", () => {
    expect(sanitizeAttachmentName("bai-tap.pdf")).toBe("bai-tap.pdf")
  })

  it("strips any path the browser sent", () => {
    expect(sanitizeAttachmentName("C:\\Users\\me\\bai tap.pdf")).toBe("bai-tap.pdf")
    expect(sanitizeAttachmentName("../../etc/passwd")).toBe("passwd")
  })

  it("never returns an empty name", () => {
    expect(sanitizeAttachmentName("///")).toBe("tep-dinh-kem")
    expect(sanitizeAttachmentName("")).toBe("tep-dinh-kem")
  })
})
