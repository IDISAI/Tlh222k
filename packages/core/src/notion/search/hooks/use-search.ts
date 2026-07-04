import { useState } from "react"

import type { Search } from "../types"

export function useSearch() {
  const [data] = useState<Search[]>([])
  return { data }
}
