import { RoadmapService as MockRoadmapService } from "../roadmap.service"
import { RoadmapApi } from "./roadmap.api"
import { roadmapBackendEnabled } from "./client"

/**
 * One `RoadmapService` name, swapped by environment: the API backend when
 * `NEXT_PUBLIC_SVC_API_URL` is set, otherwise the localStorage mock.
 * Both classes expose identical method signatures, so every `new
 * RoadmapService()` call site is unchanged. The mock stays as the offline /
 * test fallback.
 */
if (process.env.NODE_ENV === "production" && !roadmapBackendEnabled()) {
  throw new Error("NEXT_PUBLIC_SVC_API_URL is required in production")
}

export const RoadmapService: typeof MockRoadmapService = roadmapBackendEnabled()
  ? (RoadmapApi as unknown as typeof MockRoadmapService)
  : MockRoadmapService
