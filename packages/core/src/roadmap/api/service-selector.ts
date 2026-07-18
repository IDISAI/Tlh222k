import { RoadmapService as MockRoadmapService } from "../roadmap.service"
import { RoadmapApi } from "./roadmap.api"
import { roadmapBackendEnabled } from "./client"


export const RoadmapService: typeof MockRoadmapService = roadmapBackendEnabled()
  ? (RoadmapApi as unknown as typeof MockRoadmapService)
  : MockRoadmapService
