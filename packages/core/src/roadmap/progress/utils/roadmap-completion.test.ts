import { describe, expect, it } from "vitest"

import { learnerStateOf, roadmapCompletion } from "./roadmap-completion"

describe("roadmapCompletion", () => {
  it("counts only the required nodes", () => {
    // The optional node is done and the required one is not: an average over
    // everything would report 50%, which overstates how far the learner is.
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a"],
        completedNodeIds: new Set(["b"]),
      })
    ).toEqual({ percent: 0, completed: false })
  })

  it("ignores completions for nodes this roadmap no longer requires", () => {
    // Progress is stored per user+node across every roadmap, so the learner's
    // completed set contains nodes that belong elsewhere.
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a", "b"],
        completedNodeIds: new Set(["a", "z-from-another-roadmap"]),
      })
    ).toEqual({ percent: 50, completed: false })
  })

  it("completes when every current required node is done", () => {
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a", "b"],
        completedNodeIds: new Set(["a", "b"]),
      })
    ).toEqual({ percent: 100, completed: true })
  })

  it("floors the percentage rather than rounding it up", () => {
    // 2/3 must not read as 67% climbing toward a 100 the learner has not
    // reached; the last node is the one that completes a roadmap.
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a", "b", "c"],
        completedNodeIds: new Set(["a", "b"]),
      }).percent
    ).toBe(66)
  })

  it("treats a roadmap with no required node as not completed", () => {
    // Nothing to finish is not the same as finished, and reporting 100% would
    // hand out a completion nobody earned.
    expect(
      roadmapCompletion({
        requiredNodeIds: [],
        completedNodeIds: new Set(),
      })
    ).toEqual({ percent: 0, completed: false })
  })

  it("keeps a completion the learner already earned when new nodes are added", () => {
    // The contract is explicit: later required additions do not revoke it.
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a", "b", "c-added-later"],
        completedNodeIds: new Set(["a", "b"]),
        previouslyCompleted: true,
      })
    ).toEqual({ percent: 100, completed: true })
  })

  it("shows the new composition to a learner who had not completed it", () => {
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a", "b", "c-added-later"],
        completedNodeIds: new Set(["a", "b"]),
        previouslyCompleted: false,
      })
    ).toEqual({ percent: 66, completed: false })
  })

  it("counts a duplicated required id once", () => {
    expect(
      roadmapCompletion({
        requiredNodeIds: ["a", "a", "b"],
        completedNodeIds: new Set(["a"]),
      })
    ).toEqual({ percent: 50, completed: false })
  })
})

describe("learnerStateOf", () => {
  it("maps the stored vocabulary onto the contract's three states", () => {
    expect(learnerStateOf("locked")).toBe("NOT_STARTED")
    expect(learnerStateOf("in_progress")).toBe("IN_PROGRESS")
    expect(learnerStateOf("done")).toBe("COMPLETED")
  })

  it("reads anything unrecognised as not started", () => {
    expect(learnerStateOf(undefined)).toBe("NOT_STARTED")
    expect(learnerStateOf("nonsense")).toBe("NOT_STARTED")
  })
})
