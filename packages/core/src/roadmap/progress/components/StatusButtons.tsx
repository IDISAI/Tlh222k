"use client"

import { CheckCircle, Clock, Lock } from "lucide-react"

import type { NodeStatus } from "../../types"

const OPTIONS: { value: NodeStatus; label: string; icon: typeof Lock }[] = [
  { value: "locked", label: "Locked", icon: Lock },
  { value: "in_progress", label: "In Progress", icon: Clock },
  { value: "done", label: "Done", icon: CheckCircle },
]

interface StatusButtonsProps {
  status: NodeStatus
  onChange: (status: NodeStatus) => void
  disabled?: boolean
}

/** Controlled Locked / In Progress / Done selector (Req 3.4, 7.1–7.3). */
export function StatusButtons({ status, onChange, disabled }: StatusButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === status
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={
              "flex flex-col items-center gap-1 rounded-md border-2 border-black px-2 py-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 dark:border-zinc-700 " +
              (active
                ? "bg-indigo-500 text-white"
                : "bg-white text-foreground hover:bg-muted dark:bg-zinc-900")
            }
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
