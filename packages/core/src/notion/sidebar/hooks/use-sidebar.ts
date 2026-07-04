import { useState } from "react"

import type { Sidebar } from "../types"

export function useSidebar() {
  const [data] = useState<Sidebar[]>([])
  return { data }
}
