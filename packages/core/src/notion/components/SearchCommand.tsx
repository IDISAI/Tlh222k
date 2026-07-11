"use client"

import { useEffect, useState } from "react"
import { File } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"

import type { NotionDoc } from "../types"

interface SearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  getSearch: () => Promise<NotionDoc[]>
  onSelect: (doc: NotionDoc) => void
}

/** Cmd+K search over all live documents (admin zone; reuses ui/cmdk). */
export function SearchCommand({
  open,
  onOpenChange,
  getSearch,
  onSelect,
}: SearchCommandProps) {
  const [docs, setDocs] = useState<NotionDoc[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void getSearch().then((result) => {
      if (!cancelled) setDocs(result)
    })
    return () => {
      cancelled = true
    }
  }, [open, getSearch])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm kiếm trang"
      description="Tìm một trang theo tiêu đề"
    >
      <CommandInput placeholder="Tìm trang..." />
      <CommandList>
        <CommandEmpty>Không tìm thấy trang nào.</CommandEmpty>
        <CommandGroup heading="Trang">
          {docs.map((doc) => (
            <CommandItem
              key={doc.id}
              value={`${doc.title}-${doc.id}`}
              onSelect={() => {
                onSelect(doc)
                onOpenChange(false)
              }}
            >
              {doc.icon ? (
                <span className="text-base">{doc.icon}</span>
              ) : (
                <File className="size-4" />
              )}
              <span className="truncate">{doc.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
