"use client"

import { useCallback, useEffect, useState } from "react"

import type { Roadmap } from "../types"
import { RoadmapService } from "../roadmap.service"

const service = new RoadmapService()

/** Loads the published roadmap list with loading / error / retry (Req 1.4, 1.6). */
export function useRoadmap() {
  const [data, setData] = useState<Roadmap[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await service.list())
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, retry: load }
}
