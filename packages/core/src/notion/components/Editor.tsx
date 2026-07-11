"use client"

import "@blocknote/core/fonts/inter.css"
import "@blocknote/shadcn/style.css"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import type { PartialBlock } from "@blocknote/core"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"

import { Skeleton } from "@workspace/ui/components/skeleton"

interface EditorProps {
  /** BlockNote block array as JSON string (Document.content). */
  initialContent: string | null
  editable: boolean
  /** Serialized document on every change (caller debounces the save). */
  onChange?: (content: string) => void
  /** FormData("file") → public URL; enables image/file blocks (admin). */
  uploadFile?: (form: FormData) => Promise<{ url: string }>
}

function parseContent(content: string | null): PartialBlock[] | undefined {
  if (!content) return undefined
  try {
    const blocks = JSON.parse(content) as PartialBlock[]
    return Array.isArray(blocks) && blocks.length > 0 ? blocks : undefined
  } catch {
    return undefined // corrupt content → start empty instead of crashing
  }
}

/**
 * BlockNote wrapper — the ONE rich-text surface for both zones. Read-only
 * viewers get the same rendering with editing (toolbars, slash menu, drag
 * handles) disabled via `editable={false}`. BlockNote is browser-only
 * (contenteditable), so the editor mounts client-side behind a skeleton.
 */
export function Editor(props: EditorProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="space-y-3 px-6 md:px-14">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    )
  }
  return <BlockNoteEditor {...props} />
}

function BlockNoteEditor({
  initialContent,
  editable,
  onChange,
  uploadFile,
}: EditorProps) {
  const { resolvedTheme } = useTheme()

  const editor = useCreateBlockNote({
    initialContent: parseContent(initialContent),
    uploadFile: uploadFile
      ? async (file: File) => {
          const form = new FormData()
          form.append("file", file)
          const { url } = await uploadFile(form)
          return url
        }
      : undefined,
  })

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onChange={() => onChange?.(JSON.stringify(editor.document))}
    />
  )
}
