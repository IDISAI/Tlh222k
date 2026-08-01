"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

/**
 * What the lines and the dot on a public canvas mean.
 *
 * Readers arrive at a graph of blocks joined by two kinds of wire and cannot
 * tell from looking whether a dashed line is a weaker prerequisite or simply a
 * different colour. Worse, the arrows read as gates — so the legend says the
 * one thing that is easy to get wrong: an edge describes flow, it never locks
 * anything. Collapsible because on a small canvas it covers the graph, and the
 * choice sticks for the session.
 */
export function CanvasLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(true)

  return (
    <div
      className={cn(
        "pointer-events-auto absolute top-4 left-4 z-10 w-[264px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[14px] border border-border bg-background/95 shadow-float backdrop-blur",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold"
      >
        Chú giải
        {open ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronUp className="size-3.5 shrink-0" />
        )}
      </button>

      {open && (
        <dl className="space-y-2 border-t border-border px-3 py-2.5 text-[11px] leading-4">
          <div className="flex items-center gap-2.5">
            <svg
              width="26"
              height="8"
              viewBox="0 0 26 8"
              aria-hidden
              className="shrink-0"
            >
              <line
                x1="0"
                y1="4"
                x2="26"
                y2="4"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <dt className="sr-only">Nét liền</dt>
            <dd className="text-muted-foreground">Luồng chính</dd>
          </div>

          <div className="flex items-center gap-2.5">
            <svg
              width="26"
              height="8"
              viewBox="0 0 26 8"
              aria-hidden
              className="shrink-0"
            >
              <line
                x1="0"
                y1="4"
                x2="26"
                y2="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            </svg>
            <dt className="sr-only">Nét đứt</dt>
            <dd className="text-muted-foreground">Quan hệ tham chiếu</dd>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full bg-foreground"
            />
            <dt className="sr-only">Chấm đặc</dt>
            <dd className="text-muted-foreground">
              Nội dung bắt buộc, tính vào tiến độ
            </dd>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full border border-muted-foreground"
            />
            <dt className="sr-only">Chấm rỗng</dt>
            <dd className="text-muted-foreground">
              Nội dung tuỳ chọn, không tính tiến độ
            </dd>
          </div>

          <p className="border-t border-border pt-2 text-muted-foreground">
            Dây chỉ mô tả thứ tự gợi ý — không khoá nội dung nào.
          </p>
        </dl>
      )}
    </div>
  )
}
