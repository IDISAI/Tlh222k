import type { Search } from "./types"

export class SearchService {
  // ponytail: stub — wire to API/GraphQL client when backend exists
  async list(): Promise<Search[]> {
    return []
  }

  async byId(id: string): Promise<Search | null> {
    void id
    return null
  }
}
