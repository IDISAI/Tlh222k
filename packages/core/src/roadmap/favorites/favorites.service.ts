const STORAGE_KEY = "lh222k:saved-roadmaps"

/**
 * Per-browser favourites, for local development without a backend.
 *
 * The key is the one `RoadmapCard` used before favourites became
 * account-backed, so a developer's existing local list survives the change.
 */
export class FavoritesService {
  async list(): Promise<string[]> {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  }

  async set(ownerNodeId: string, favorite: boolean): Promise<boolean> {
    if (typeof window === "undefined") return favorite
    try {
      const current = (await this.list()).filter((id) => id !== ownerNodeId)
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(favorite ? [...current, ownerNodeId] : current)
      )
    } catch {
      /* private mode / quota — the caller's optimistic state still applies */
    }
    return favorite
  }
}
