"use client"

import type { ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

// ponytail: curated grid instead of an emoji-picker dependency (spec allows no
// new deps beyond blocknote/dnd-kit/blob). Swap for a picker lib if admins
// ever need the full emoji set.
const EMOJIS = [
  "📄", "📝", "📚", "📖", "📌", "📋", "🗂️", "🗒️",
  "💡", "🎯", "🚀", "⭐", "🔥", "✨", "✅", "❗",
  "🧠", "🛠️", "⚙️", "🧪", "🔬", "🔍", "🧭", "🗺️",
  "💻", "🖥️", "⌨️", "🖱️", "🌐", "🔗", "🔒", "🔑",
  "📊", "📈", "📉", "🧮", "🗃️", "💾", "🐍", "☕",
  "🎨", "🎓", "🏆", "🎉", "❤️", "👋", "🙌", "🤖",
]

interface IconPickerProps {
  onSelect: (emoji: string) => void
  onRemove?: () => void
  children: ReactNode
}

/** Emoji picker popover for the document icon (admin editor only). */
export function IconPicker({ onSelect, onRemove, children }: IconPickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={<span className="inline-flex" />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-2 p-3" align="start">
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="rounded-md p-1 text-lg transition-colors hover:bg-muted"
            >
              {emoji}
            </button>
          ))}
        </div>
        {onRemove && (
          <Button variant="ghost" size="xs" onClick={onRemove}>
            Xóa icon
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
