import { roadmapBackendEnabled } from "../api/client"
import { FavoritesApi } from "./favorites.api"
import { FavoritesService } from "./favorites.service"

/**
 * Same env-flag seam as the roadmap and progress stores.
 *
 * Kept in its own module rather than the barrel: `use-favorite` needs it, and
 * importing it from the barrel — which in turn exports the hook — leaves the
 * binding undefined at module-init time.
 */
export const FavoritesStore: typeof FavoritesService = roadmapBackendEnabled()
  ? (FavoritesApi as unknown as typeof FavoritesService)
  : FavoritesService
