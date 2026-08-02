"use client"

import { useEffect, useState } from "react"

import type { Field } from "../types"
import { RoadmapService } from "../api"

const service = new RoadmapService()

/**
 * Loads the discovery labels backing the /roadmaps tab strip.
 *
 * Failure is deliberately silent: the strip is a filter affordance, not
 * content. If labels can't be fetched the page still lists every roadmap,
 * which is strictly better than an error panel over a working catalogue.
 */
export function useFields() {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    service
      .listFields()
      .then((next) => {
        if (!cancelled) setFields(next)
      })
      .catch(() => {
        if (!cancelled) setFields([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { fields, loading }
}
