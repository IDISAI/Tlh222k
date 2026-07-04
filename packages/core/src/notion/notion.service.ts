import type { Notion } from "./types"

export class NotionService {
  // ponytail: stub — wire to API/GraphQL client when backend exists
  async list(): Promise<Notion[]> {
    return []
  }

  async byId(id: string): Promise<Notion | null> {
    void id
    return null
  }
}
