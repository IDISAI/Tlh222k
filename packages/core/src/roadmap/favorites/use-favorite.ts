"use client"

import { useCallback, useEffect, useState } from "react"

import { FavoritesStore } from "./favorites-selector"

const store = new FavoritesStore()

/**
 * One roadmap's favourite state.
 *
 * The list is fetched after mount rather than during render so the
 * server-rendered markup and the first client render agree — with the mock
 * store `localStorage` is unavailable during SSR, and with the backend the
 * answer depends on who is signed in.
 *
 * The toggle is optimistic and reconciles against what the server says it
 * stored: a guest hitting the account-backed store is refused, and rolling
 * back is the only honest response to that.
 */
export function useFavorite(ownerNodeId: string) {
  const [favorite, setFavorite] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    store
      .list()
      .then((ids) => {
        if (!cancelled) setFavorite(ids.includes(ownerNodeId))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ownerNodeId])

  const toggle = useCallback(async () => {
    const previous = favorite
    const next = !previous
    setFavorite(next)
    setSaving(true)
    try {
      const stored = await store.set(ownerNodeId, next)
      setFavorite(stored)
    } catch {
      setFavorite(previous)
    } finally {
      setSaving(false)
    }
  }, [favorite, ownerNodeId])

  return { favorite, toggle, saving }
}
