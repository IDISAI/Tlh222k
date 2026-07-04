import { useState } from "react"

import type { Graph } from "../types"

export function useGraph() {
  const [data] = useState<Graph[]>([])
  return { data }
}
