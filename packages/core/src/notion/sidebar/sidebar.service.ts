import type { Sidebar } from "./types"

export class SidebarService {
  // ponytail: stub — wire to API/GraphQL client when backend exists
  async list(): Promise<Sidebar[]> {
    return []
  }

  async byId(id: string): Promise<Sidebar | null> {
    void id
    return null
  }
}
