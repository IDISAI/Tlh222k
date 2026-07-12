"use client"

import "@blocknote/core/fonts/inter.css"
import "@blocknote/shadcn/style.css"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { codeBlockOptions } from "@blocknote/code-block"
import { filterSuggestionItems, type PartialBlock } from "@blocknote/core"
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"

import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  customSlashMenuItems,
  mentionMenuItems,
  notionSchema,
  setGetPages,
  type NotionPageRef,
} from "./blocks"

interface EditorProps {
  /** BlockNote block array as JSON string (Document.content). */
  initialContent: string | null
  editable: boolean
  /** Serialized document on every change (caller debounces the save). */
  onChange?: (content: string) => void
  /** FormData("file") → public URL; enables image/file blocks (admin). */
  uploadFile?: (form: FormData) => Promise<{ url: string }>
  /** Page list for @-mentions and link_to_page pickers (admin). */
  getPages?: () => Promise<NotionPageRef[]>
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
 *
 * Block coverage (notion-article-node Req 12): BlockNote built-ins
 * (paragraph, heading 1-3, lists, todo, toggle, quote, divider, table, code,
 * image, video, audio, file) plus custom callout / embed / link_to_page
 * blocks and @-mention inline content from ./blocks.
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
  getPages,
}: EditorProps) {
  const { resolvedTheme } = useTheme()

  // Block specs are schema-global; the page picker inside linkToPage reads
  // this module-level ref (see ./blocks).
  useEffect(() => {
    setGetPages(getPages)
    return () => setGetPages(undefined)
  }, [getPages])

  const editor = useCreateBlockNote({
    schema: notionSchema,
    // Req 12.13: syntax highlighting + language picker for code blocks
    // (shiki bundle covers JS/TS/Python/HTML/CSS/SQL/JSON/Bash and more).
    codeBlock: codeBlockOptions,
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
      slashMenu={false}
    >
      {/* "/" — defaults + callout/embed/link_to_page (Req 12.19). */}
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [
              ...getDefaultReactSlashMenuItems(editor),
              ...customSlashMenuItems(editor),
            ],
            query
          )
        }
      />
      {/* "@" — page + date mentions (Req 12.14). */}
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={async (query) =>
          filterSuggestionItems(await mentionMenuItems(editor, getPages), query)
        }
      />
    </BlockNoteView>
  )
}
