"use client"

import { useCallback, useEffect, useState } from "react"

import type { Roadmap } from "../types"
import { RoadmapService } from "../api"

const service = new RoadmapService()

/** Loads the published roadmap list with loading / error / retry (Req 1.4, 1.6). */
export function useRoadmap() {
  const [data, setData] = useState<Roadmap[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      setData(await service.list())
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()

    const handleRestore = () => {
      void load(true)
    }
    window.addEventListener("bfcache-restore", handleRestore)
    return () => {
      window.removeEventListener("bfcache-restore", handleRestore)
    }
  }, [load])

  return { data, loading, error, retry: load }
}
