import { useState } from "react"

import type { ContentEditor } from "../types"

export function useContentEditor() {
  const [data] = useState<ContentEditor[]>([])
  return { data }
}
