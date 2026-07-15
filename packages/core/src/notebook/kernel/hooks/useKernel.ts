"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { KernelAdapter, KernelStatus } from "../types"
import { PyodideKernelAdapter } from "../pyodide/pyodide-adapter"

export interface UseKernel {
  status: KernelStatus
  /** Lazily creates the adapter on first call (deferred boot). */
  getAdapter: () => KernelAdapter
  restart: () => Promise<void>
}

/**
 * Owns a single Pyodide kernel adapter for the lifetime of the component.
 * The adapter (and thus the worker) is not created until `getAdapter()` is
 * first called — i.e. the user runs a cell — so the page stays cheap until
 * then. The worker is torn down on unmount.
 */
export function useKernel(createWorker: () => Worker): UseKernel {
  const adapterRef = useRef<KernelAdapter | null>(null)
  const [status, setStatus] = useState<KernelStatus>("uninitialized")

  // Keep the latest factory without re-creating the adapter each render.
  const factoryRef = useRef(createWorker)
  factoryRef.current = createWorker

  const getAdapter = useCallback((): KernelAdapter => {
    if (!adapterRef.current) {
      const adapter = new PyodideKernelAdapter(() => factoryRef.current())
      adapter.subscribeStatus(setStatus)
      adapterRef.current = adapter
    }
    return adapterRef.current
  }, [])

  const restart = useCallback(async () => {
    await adapterRef.current?.restart()
  }, [])

  useEffect(() => {
    return () => {
      adapterRef.current?.dispose()
      adapterRef.current = null
    }
  }, [])

  return { status, getAdapter, restart }
}
