"use client"

import { useEffect, useState } from "react"

import type { RoadmapProgress } from "../../types"
import { ProgressService } from "../../progress/progress.service"

const service = new ProgressService()

/** Loads the viewer's per-roadmap progress summary for the dashboard. */
export function useMyProgress() {
  const [data, setData] = useState<RoadmapProgress[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    service
      .myProgress()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading }
}
