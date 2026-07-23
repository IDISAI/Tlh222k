import { describe, expect, it } from "vitest"

import { NotebookService } from "./notebook.service"

describe("NotebookService language metadata", () => {
  it("preserves kernelspec and language_info through parse and serialize", () => {
    const service = new NotebookService()
    const parsed = service.parse({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          name: "deno",
          display_name: "Deno",
          language: "javascript",
        },
        language_info: { name: "javascript", version: "2" },
      },
      cells: [],
    })

    expect(parsed.language).toBe("javascript")
    expect(service.serialize(parsed).metadata).toMatchObject({
      kernelspec: { name: "deno", language: "javascript" },
      language_info: { name: "javascript", version: "2" },
    })
  })
})
