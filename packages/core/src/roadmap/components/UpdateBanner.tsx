"use client"

import { useEffect, useRef, useState } from "react"
import { BellRing, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { subscribeRoadmapUpdates } from "../utils/update-signal"

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2_000

interface UpdateBannerProps {
  /** Limit to one roadmap; omit to react to any roadmap update. */
  roadmapId?: string | null
}

/**
 * Sticky viewer banner (Req 8.1): appears when the builder saves, offering
 * "Tải lại ngay" / "Bỏ qua". Reconnects up to 3 times, 2s apart, then goes
 * quiet until the transport recovers (Req 8.5).
 */
export function UpdateBanner({ roadmapId = null }: UpdateBannerProps) {
  const [show, setShow] = useState(false)
  const retriesRef = useRef(0)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const connect = () => {
      if (disposed) return
      unsubscribe = subscribeRoadmapUpdates(
        roadmapId,
        () => {
          retriesRef.current = 0
          setShow(true)
        },
        () => {
          unsubscribe?.()
          unsubscribe = null
          if (retriesRef.current < MAX_RETRIES) {
            retriesRef.current += 1
            retryTimer = setTimeout(connect, RETRY_DELAY_MS)
          } else {
            // Req 8.5: after 3 failed attempts stop announcing updates.
            setShow(false)
          }
        }
      )
    }

    connect()
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      unsubscribe?.()
    }
  }, [roadmapId])

  if (!show) return null

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
      <BellRing className="size-4 shrink-0" />
      <p>
        Roadmap đã được cập nhật — tải lại trang để xem phiên bản mới nhất.
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Tải lại ngay
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShow(false)}
        >
          <X className="size-3.5" /> Bỏ qua
        </Button>
      </div>
    </div>
  )
}
