import { Controller, Query, Sse, MessageEvent } from "@nestjs/common"
import { filter, map, Observable } from "rxjs"
import { RoadmapEventsService } from "./roadmap-events.service"

/**
 * `GET /roadmap-updates?id=<roadmapId>` — Server-Sent Events stream the viewer
 * subscribes to (UpdateBanner). Emits `data: updated` when the given roadmap
 * (or any, if `id` omitted) is written, ≤500ms after the write (Req 8).
 */
@Controller("roadmap-updates")
export class SseController {
  constructor(private readonly events: RoadmapEventsService) {}

  @Sse()
  stream(@Query("id") id?: string): Observable<MessageEvent> {
    return this.events.stream().pipe(
      filter((signal) => !id || signal.roadmapId === id),
      map((signal): MessageEvent => ({ data: "updated", id: String(signal.at) }))
    )
  }
}
