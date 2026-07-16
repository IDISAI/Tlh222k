import { Module } from "@nestjs/common"

import { RoadmapService } from "./roadmap.service"
import { RoadmapResolver } from "./roadmap.resolver"
import { RoadmapRestController } from "./roadmap.controller"
import { SseController } from "../sse/sse.controller"
import { RoadmapEventsService } from "../sse/roadmap-events.service"

@Module({
  controllers: [SseController, RoadmapRestController],
  providers: [RoadmapService, RoadmapResolver, RoadmapEventsService],
})
export class RoadmapModule {}

