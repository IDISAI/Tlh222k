"use client"

import { useCallback, useState } from "react"

import type { NodeStatus } from "../../types"
import { ProgressService } from "../progress.service"

const service = new ProgressService()

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

/**
 * Optimistic node-status updates. The new status shows immediately (<100ms,
 * Req 7.4); on failure or 10s timeout it rolls back to the prior value
 * (Property 9 / P3).
 */
export function useNodeStatus(nodeId: string, initialStatus: NodeStatus) {
  const [status, setStatus] = useState<NodeStatus>(initialStatus)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(
    async (next: NodeStatus) => {
      const previous = status
      setStatus(next) // optimistic
      setIsLoading(true)
      setError(null)
      try {
        await withTimeout(service.set(nodeId, next), 10_000)
      } catch (err) {
        setStatus(previous) // rollback
        setError(err instanceof Error ? err : new Error("update failed"))
      } finally {
        setIsLoading(false)
      }
    },
    [nodeId, status]
  )

  return { status, setStatus: update, isLoading, error }
}
