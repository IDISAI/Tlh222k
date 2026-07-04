import type { ContentEditor } from "./types"

export class ContentEditorService {
  // ponytail: stub — wire to API/GraphQL client when backend exists
  async list(): Promise<ContentEditor[]> {
    return []
  }

  async byId(id: string): Promise<ContentEditor | null> {
    void id
    return null
  }
}
