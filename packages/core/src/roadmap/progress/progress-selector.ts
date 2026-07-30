import { roadmapBackendEnabled } from "../api/client"
import { ProgressApi } from "./progress.api"
import { ProgressService as MockProgressService } from "./progress.service"

/**
 * Same env-flag seam the roadmap service uses. With a backend URL configured
 * progress belongs to the learner's account; without one it falls back to the
 * per-browser mock, which is local development only — see the warning in
 * CLAUDE.md about the mock never running on a deployed environment.
 */
export const ProgressStore: typeof MockProgressService = roadmapBackendEnabled()
  ? (ProgressApi as unknown as typeof MockProgressService)
  : MockProgressService
