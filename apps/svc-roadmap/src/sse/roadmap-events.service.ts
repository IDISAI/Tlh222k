import { Injectable } from "@nestjs/common"
import { Subject, Observable } from "rxjs"

export interface RoadmapUpdateSignal {
  roadmapId: string
  at: number
}

/**
 * In-memory pub/sub for roadmap writes. Every successful mutation calls
 * `emit(roadmapId)`; the SSE controller streams matching signals to viewers
 * (replaces the mock BroadcastChannel with a real cross-origin transport).
 * Prod upgrade: back the Subject with Redis pub/sub.
 */
@Injectable()
export class RoadmapEventsService {
  private readonly subject = new Subject<RoadmapUpdateSignal>()

  emit(roadmapId: string): void {
    this.subject.next({ roadmapId, at: Date.now() })
  }

  stream(): Observable<RoadmapUpdateSignal> {
    return this.subject.asObservable()
  }
}
