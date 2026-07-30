import { describe, expect, it } from "vitest"

import { axesOfBlock, blockIsListed, blockOpensByLink } from "./block-access"

describe("axesOfBlock", () => {
  it("splits the legacy PRIVATE status into published-but-unlisted", () => {
    // The tri-state predates the contract and folds two independent axes into
    // one value. PRIVATE never meant unfinished — it meant do not list.
    expect(axesOfBlock("PRIVATE")).toEqual({
      lifecycleStatus: "PUBLISHED",
      discoverability: "PRIVATE",
    })
  })

  it("maps PUBLISHED to listed and open", () => {
    expect(axesOfBlock("PUBLISHED")).toEqual({
      lifecycleStatus: "PUBLISHED",
      discoverability: "PUBLIC",
    })
  })

  it("maps DRAFT to unpublished", () => {
    expect(axesOfBlock("DRAFT")).toEqual({
      lifecycleStatus: "DRAFT",
      discoverability: "PUBLIC",
    })
  })

  it("reads anything unrecognised as a draft", () => {
    expect(axesOfBlock(null).lifecycleStatus).toBe("DRAFT")
    expect(axesOfBlock("nonsense").lifecycleStatus).toBe("DRAFT")
  })
})

describe("blockOpensByLink", () => {
  it("opens a published block", () => {
    expect(blockOpensByLink("PUBLISHED")).toBe(true)
  })

  it("opens an unlisted block — the whole point of a direct link", () => {
    expect(blockOpensByLink("PRIVATE")).toBe(true)
  })

  it("refuses a draft", () => {
    expect(blockOpensByLink("DRAFT")).toBe(false)
    expect(blockOpensByLink(undefined)).toBe(false)
  })
})

describe("blockIsListed", () => {
  it("lists only a published, discoverable block", () => {
    expect(blockIsListed("PUBLISHED")).toBe(true)
  })

  it("never lists an unlisted or draft block", () => {
    expect(blockIsListed("PRIVATE")).toBe(false)
    expect(blockIsListed("DRAFT")).toBe(false)
  })
})
