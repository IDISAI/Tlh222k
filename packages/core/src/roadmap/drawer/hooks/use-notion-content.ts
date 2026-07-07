"use client"

import { useEffect, useState } from "react"

interface NotionContentState {
  markdown: string | null
  loading: boolean
  error: string | null
}

/**
 * Fetches a node's Notion markdown from the same-origin route handler with a 5s
 * timeout (Req 3.6). A null/empty pageId short-circuits (placeholder in drawer).
 */
export function useNotionContent(
  notionPageId: string | null | undefined
): NotionContentState {
  const [state, setState] = useState<NotionContentState>({
    markdown: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!notionPageId) {
      setState({ markdown: null, loading: false, error: null })
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    setState({ markdown: null, loading: true, error: null })

    fetch(`/api/notion/${notionPageId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { markdown?: string }
        if (!cancelled) {
          setState({ markdown: json.markdown ?? "", loading: false, error: null })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ markdown: null, loading: false, error: "Nội dung chưa có sẵn" })
        }
      })
      .finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [notionPageId])

  return state
}
