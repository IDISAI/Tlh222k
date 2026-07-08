/**
 * Roadmap update signal (Req 8): the builder emits after every successful
 * write; viewer tabs subscribe to show the "reload" banner.
 *
 * Mock transport: BroadcastChannel with a localStorage `storage`-event
 * fallback — works across tabs on the same origin (the web host proxies the
 * admin zone, so both apps share one origin).
 * ponytail: → SSE endpoint `/api/roadmap-updates` backed by Redis pub/sub.
 */

const CHANNEL = "roadmap-updates"
const STORAGE_KEY = "roadmap-updates:last"

export interface RoadmapUpdateSignal {
  roadmapId: string
  at: number
}

/** Broadcast that `roadmapId` changed. No-op on the server. Fires ≤500ms (Req 8.3). */
export function emitRoadmapUpdate(roadmapId: string): void {
  if (typeof window === "undefined") return
  const signal: RoadmapUpdateSignal = { roadmapId, at: Date.now() }
  try {
    new BroadcastChannel(CHANNEL).postMessage(signal)
  } catch {
    // BroadcastChannel unsupported → the storage event below still fires.
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(signal))
  } catch {
    // Ignore quota/privacy-mode failures; the broadcast already went out.
  }
}

/**
 * Listen for update signals for `roadmapId` (or all roadmaps when omitted).
 * Returns an unsubscribe function. `onConnectionLost` fires if the transport
 * cannot be established, letting the caller run its retry policy (Req 8.5).
 */
export function subscribeRoadmapUpdates(
  roadmapId: string | null,
  onUpdate: (signal: RoadmapUpdateSignal) => void,
  onConnectionLost?: () => void
): () => void {
  if (typeof window === "undefined") return () => {}

  const matches = (signal: RoadmapUpdateSignal) =>
    !roadmapId || signal.roadmapId === roadmapId

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent<RoadmapUpdateSignal>) => {
      if (matches(event.data)) onUpdate(event.data)
    }
    channel.onmessageerror = () => onConnectionLost?.()
  } catch {
    onConnectionLost?.()
  }

  // Same-origin fallback for tabs where BroadcastChannel is unavailable.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      const signal = JSON.parse(event.newValue) as RoadmapUpdateSignal
      if (matches(signal)) onUpdate(signal)
    } catch {
      // Malformed payload — ignore.
    }
  }
  window.addEventListener("storage", onStorage)

  return () => {
    channel?.close()
    window.removeEventListener("storage", onStorage)
  }
}
