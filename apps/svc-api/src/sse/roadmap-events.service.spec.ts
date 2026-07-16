import { afterEach, describe, expect, it, vi } from "vitest"

import { RoadmapEventsService } from "./roadmap-events.service"

describe("RoadmapEventsService", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("delivers persisted events across service instances", async () => {
    vi.useFakeTimers({ now: new Date("2026-07-16T00:00:00.000Z") })
    const rows: Array<{ id: string; roadmapId: string; createdAt: Date }> = []
    const prisma = {
      roadmapUpdateEvent: {
        create: vi.fn(async ({ data }: { data: { roadmapId: string } }) => {
          const row = {
            id: `event-${rows.length + 1}`,
            roadmapId: data.roadmapId,
            createdAt: new Date(),
          }
          rows.push(row)
          return row
        }),
        findMany: vi.fn(async () => [...rows]),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    }
    const writer = new RoadmapEventsService(prisma as never)
    const reader = new RoadmapEventsService(prisma as never)
    const received: Array<{ roadmapId: string; at: number }> = []
    const subscription = reader.stream("roadmap-a").subscribe((signal) => {
      received.push(signal)
    })

    await writer.emit("roadmap-a")
    await vi.advanceTimersByTimeAsync(0)

    expect(prisma.roadmapUpdateEvent.create).toHaveBeenCalledWith({
      data: { roadmapId: "roadmap-a" },
    })
    expect(received).toHaveLength(1)
    expect(received[0]?.roadmapId).toBe("roadmap-a")
    subscription.unsubscribe()
  })
})
