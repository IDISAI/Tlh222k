import type { Roadmap } from "./types"

export class RoadmapService {
  // ponytail: stub — wire to API/GraphQL client when backend exists
  async list(): Promise<Roadmap[]> {
    return []
  }

  async byId(id: string): Promise<Roadmap | null> {
    void id
    return null
  }
}
