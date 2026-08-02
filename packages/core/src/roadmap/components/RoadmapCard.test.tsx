import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { Roadmap } from "../types"
import { RoadmapCard } from "./RoadmapCard"

// This suite has no setup file enabling auto-cleanup, so without this each
// render stacks onto the previous one and every getByText finds two matches.
afterEach(cleanup)

function roadmap(overrides: Partial<Roadmap> = {}): Roadmap {
  return {
    id: "rm-1",
    slug: "dai-so-tuyen-tinh",
    title: "Đại số tuyến tính",
    description: null,
    thumbnailUrl: null,
    publishStatus: "PUBLISHED",
    discoverability: "PUBLIC",
    visibility: "FREE",
    nodeCount: 3,
    fields: [],
    ...overrides,
  }
}

describe("RoadmapCard entitlement badge", () => {
  it("labels a free roadmap", () => {
    render(<RoadmapCard roadmap={roadmap()} />)
    expect(screen.getByText("Miễn phí")).toBeTruthy()
  })

  it("labels an internal roadmap for AIO learners, never as Premium", () => {
    render(<RoadmapCard roadmap={roadmap({ visibility: "INTERNAL" })} />)
    expect(screen.getByText("Dành cho học viên AIO")).toBeTruthy()
    expect(screen.queryByText(/premium/i)).toBeNull()
  })
})

describe("RoadmapCard across all three axes", () => {
  it("says nothing extra about a plainly public roadmap", () => {
    render(<RoadmapCard roadmap={roadmap()} />)
    expect(screen.queryByText(/đường dẫn trực tiếp/)).toBeNull()
    expect(screen.queryByText(/Bản nháp/)).toBeNull()
  })

  it("warns that an unlisted roadmap is link-only", () => {
    render(<RoadmapCard roadmap={roadmap({ discoverability: "PRIVATE" })} />)
    expect(screen.getByText(/Chỉ mở được bằng đường dẫn trực tiếp/)).toBeTruthy()
  })

  it("warns that a draft is not reachable by learners", () => {
    render(<RoadmapCard roadmap={roadmap({ publishStatus: "DRAFT" })} />)
    expect(screen.getByText(/Bản nháp, người học chưa xem được/)).toBeTruthy()
  })

  it("states the AIO requirement alongside the badge", () => {
    render(<RoadmapCard roadmap={roadmap({ visibility: "INTERNAL" })} />)
    expect(screen.getByText(/Cần tài khoản AIO để mở/)).toBeTruthy()
  })

  it("reports all three reasons when a roadmap is draft, unlisted and internal", () => {
    render(
      <RoadmapCard
        roadmap={roadmap({
          publishStatus: "DRAFT",
          discoverability: "PRIVATE",
          visibility: "INTERNAL",
        })}
      />
    )
    // One line, three reasons — an editor should not have to open the CMS to
    // learn why nobody can see this card's roadmap.
    expect(
      screen.getByText(
        /Bản nháp.*đường dẫn trực tiếp.*Cần tài khoản AIO/
      )
    ).toBeTruthy()
  })

  it("treats a roadmap with no axis data as closed rather than public", () => {
    // Legacy localStorage snapshots predate discoverability and visibility.
    const legacy = roadmap()
    delete (legacy as Partial<Roadmap>).discoverability
    delete (legacy as Partial<Roadmap>).visibility
    render(<RoadmapCard roadmap={{ ...legacy, publishStatus: "DRAFT" }} />)
    expect(screen.getByText(/Bản nháp/)).toBeTruthy()
    expect(screen.getByText("Miễn phí")).toBeTruthy()
  })
})
