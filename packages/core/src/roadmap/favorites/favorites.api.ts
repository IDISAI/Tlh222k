import { gql } from "../api/client"

/**
 * Account-backed favourites.
 *
 * The contract puts favourites on the account, not the browser: a learner who
 * saves a roadmap on their laptop expects to find it on their phone, and the
 * publish notification in #68 targets exactly the people who favourited or
 * started a roadmap — which a localStorage list can never tell the server.
 */
export class FavoritesApi {
  async list(): Promise<string[]> {
    const data = await gql<{ myFavoriteRoadmapIds: string[] }>(
      `query { myFavoriteRoadmapIds }`
    )
    return data.myFavoriteRoadmapIds ?? []
  }

  /** Returns the state actually stored, so an optimistic UI can reconcile. */
  async set(ownerNodeId: string, favorite: boolean): Promise<boolean> {
    const data = await gql<{ setRoadmapFavorite: boolean }>(
      `mutation ($ownerNodeId: ID!, $favorite: Boolean!) {
        setRoadmapFavorite(ownerNodeId: $ownerNodeId, favorite: $favorite)
      }`,
      { ownerNodeId, favorite }
    )
    return data.setRoadmapFavorite
  }
}
