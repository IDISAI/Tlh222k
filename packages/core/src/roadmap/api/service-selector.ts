import { RoadmapService as MockRoadmapService } from "../roadmap.service"
import { RoadmapApi } from "./roadmap.api"
import { roadmapBackendEnabled } from "./client"

/**
 * One `RoadmapService` name, swapped by environment: the svc-roadmap backend
 * when `NEXT_PUBLIC_SVC_ROADMAP_URL` is set, otherwise the localStorage mock.
 * Both classes expose identical method signatures, so every `new
 * RoadmapService()` call site is unchanged. The mock stays as the offline /
 * test fallback.
 */
export const RoadmapService: typeof MockRoadmapService = roadmapBackendEnabled()
  ? (RoadmapApi as unknown as typeof MockRoadmapService)
  : MockRoadmapService
