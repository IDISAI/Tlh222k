import { describe, expect, it } from "vitest"

import { tokenizeCode } from "./highlight"

describe("tokenizeCode", () => {
  it.each(["python", "javascript", "cpp", "java", "rust", "go", "julia"])(
    "preserves complete %s source",
    (language) => {
      const source = "value = 42\n"

      expect(tokenizeCode(source, language).map((token) => token.text).join(""))
        .toBe(source)
    }
  )

  it("highlights Julia syntax", () => {
    const tokens = tokenizeCode("function square(x)\n  x^2\nend\n", "julia")

    expect(tokens.some((token) => token.type !== "")).toBe(true)
  })

  it("falls back to one plain-text token for unknown languages", () => {
    expect(tokenizeCode("hello", "unknown")).toEqual([
      { text: "hello", type: "" },
    ])
  })
})
