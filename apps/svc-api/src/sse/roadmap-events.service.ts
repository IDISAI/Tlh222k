import { Injectable } from "@nestjs/common"
import { concatMap, defer, from, map, mergeMap, Observable, timer } from "rxjs"

import { PrismaService } from "../prisma/prisma.service"

export interface RoadmapUpdateSignal {
  eventId: string
  roadmapId: string
  at: number
}

const POLL_INTERVAL_MS = 300
const RETENTION_MS = 24 * 60 * 60 * 1_000
const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000

/** Database-backed event stream shared by every API instance. */
@Injectable()
export class RoadmapEventsService {
  private lastCleanupAt = 0

  constructor(private readonly prisma: PrismaService) {}

  async emit(roadmapId: string): Promise<void> {
    await this.prisma.roadmapUpdateEvent.create({ data: { roadmapId } })
  }

  stream(roadmapId?: string): Observable<RoadmapUpdateSignal> {
    return defer(() => {
      let cursorAt = new Date()
      let cursorId = ""

      return timer(0, POLL_INTERVAL_MS).pipe(
        concatMap(async () => {
          this.cleanupBestEffort()
          const rows = await this.prisma.roadmapUpdateEvent.findMany({
            where: {
              ...(roadmapId ? { roadmapId } : {}),
              OR: [
                { createdAt: { gt: cursorAt } },
                { createdAt: cursorAt, id: { gt: cursorId } },
              ],
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 100,
          })
          const last = rows.at(-1)
          if (last) {
            cursorAt = last.createdAt
            cursorId = last.id
          }
          return rows
        }),
        mergeMap((rows) => from(rows)),
        map((row) => ({
          eventId: row.id,
          roadmapId: row.roadmapId,
          at: row.createdAt.getTime(),
        }))
      )
    })
  }

  private cleanupBestEffort(): void {
    const now = Date.now()
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return
    this.lastCleanupAt = now
    void this.prisma.roadmapUpdateEvent
      .deleteMany({
        where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
      })
      .catch(() => undefined)
  }
}
