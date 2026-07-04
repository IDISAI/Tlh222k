import { useState } from "react"

import type { Roadmap } from "../types"

export function useRoadmap() {
  const [data] = useState<Roadmap[]>([])
  return { data }
}
