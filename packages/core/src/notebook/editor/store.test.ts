import { afterEach, describe, expect, it, vi } from "vitest"

import { HttpNotebookStore, LocalNotebookStore } from "./store"

const rawNotebook = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { title: "Legacy" },
  cells: [
    {
      id: "cell-1",
      cell_type: "markdown",
      source: "# Legacy",
      metadata: {},
    },
  ],
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe("LocalNotebookStore metadata compatibility", () => {
  it("defaults missing legacy metadata and rejects arbitrary profiles", async () => {
    localStorage.setItem(
      "notebook:legacy",
      JSON.stringify({ notebook: rawNotebook, meta: { published: true } })
    )
    localStorage.setItem(
      "notebook:invalid-profile",
      JSON.stringify({
        notebook: rawNotebook,
        published: true,
        runtimeProfile: "gpu-admin",
      })
    )

    const store = new LocalNotebookStore()
    await expect(store.load("legacy")).resolves.toMatchObject({
      meta: { published: true, runtimeProfile: "data-science" },
    })
    await expect(store.load("invalid-profile")).resolves.toMatchObject({
      meta: { published: true, runtimeProfile: "data-science" },
    })
  })
})

describe("HttpNotebookStore", () => {
  it("surfaces non-successful remove responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    )
    const store = new HttpNotebookStore("https://kernel.example")

    await expect(store.remove("demo")).rejects.toThrow("remove demo: 503")
  })
})
