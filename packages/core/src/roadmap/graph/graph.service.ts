import type { Graph } from "./types"

export class GraphService {
  // ponytail: stub — wire to API/GraphQL client when backend exists
  async list(): Promise<Graph[]> {
    return []
  }

  async byId(id: string): Promise<Graph | null> {
    void id
    return null
  }
}
