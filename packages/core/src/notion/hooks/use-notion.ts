import { useState } from "react"

import type { Notion } from "../types"

export function useNotion() {
  const [data] = useState<Notion[]>([])
  return { data }
}
