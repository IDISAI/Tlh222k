"use client"

import { useEffect, useState } from "react"
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core"
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react"
import {
  FileText,
  Lightbulb,
  Link2,
  MonitorPlay,
} from "lucide-react"

// ── Cross-component navigation ───────────────────────────────────────────────

/**
 * Custom DOM event fired when a page chip (mention / link_to_page) is clicked.
 * `NotionWorkspace` listens and selects the doc — no prop drilling through
 * BlockNote's render tree.
 */
export const OPEN_DOC_EVENT = "notion:open-doc"

export function dispatchOpenDoc(docId: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_DOC_EVENT, { detail: docId }))
}

/** Minimal page reference for the @-mention and link_to_page pickers. */
export interface NotionPageRef {
  id: string
  title: string
  icon: string | null
}

// ── Callout (Req 12.6) ───────────────────────────────────────────────────────

const CALLOUT_EMOJIS = ["💡", "⚠️", "📌", "✅", "❗", "🔥"] as const

const Callout = createReactBlockSpec(
  {
    type: "callout",
    propSchema: { emoji: { default: "💡" } },
    content: "inline",
  },
  {
    render: ({ block, editor, contentRef }) => (
      <div className="my-1 flex w-full items-start gap-2 rounded-md bg-muted p-3">
        <button
          type="button"
          contentEditable={false}
          title="Đổi biểu tượng"
          className="shrink-0 rounded text-lg leading-6 hover:bg-foreground/10"
          onClick={() => {
            // ponytail: cycle a preset list; swap for the emoji picker if
            // callout icons ever need full freedom.
            const current = CALLOUT_EMOJIS.indexOf(
              block.props.emoji as (typeof CALLOUT_EMOJIS)[number]
            )
            editor.updateBlock(block, {
              props: {
                emoji: CALLOUT_EMOJIS[(current + 1) % CALLOUT_EMOJIS.length],
              },
            })
          }}
        >
          {block.props.emoji}
        </button>
        <div ref={contentRef} className="min-w-0 flex-1" />
      </div>
    ),
  }
)

// ── Embed (Req 12.12) ────────────────────────────────────────────────────────

function EmbedBlock({
  url,
  editable,
  onSubmit,
}: {
  url: string
  editable: boolean
  onSubmit: (url: string) => void
}) {
  const [draft, setDraft] = useState("")
  if (url) {
    return (
      <iframe
        src={url}
        title={url}
        className="my-1 aspect-video w-full rounded-md border"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allowFullScreen
      />
    )
  }
  if (!editable) return null
  return (
    <div
      contentEditable={false}
      className="my-1 flex w-full items-center gap-2 rounded-md border border-dashed p-3"
    >
      <MonitorPlay className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={draft}
        placeholder="Dán URL để nhúng (YouTube, Figma, Google Drive...)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) onSubmit(draft.trim())
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <button
        type="button"
        disabled={!draft.trim()}
        onClick={() => draft.trim() && onSubmit(draft.trim())}
        className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        Nhúng
      </button>
    </div>
  )
}

const Embed = createReactBlockSpec(
  {
    type: "embed",
    propSchema: { url: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <EmbedBlock
        url={block.props.url}
        editable={editor.isEditable}
        onSubmit={(url) => editor.updateBlock(block, { props: { url } })}
      />
    ),
  }
)

// ── Link to page (Req 12.15) ─────────────────────────────────────────────────

function LinkToPageBlock({
  docId,
  title,
  icon,
  editable,
  getPages,
  onPick,
}: {
  docId: string
  title: string
  icon: string
  editable: boolean
  getPages?: () => Promise<NotionPageRef[]>
  onPick: (page: NotionPageRef) => void
}) {
  const [pages, setPages] = useState<NotionPageRef[] | null>(null)

  useEffect(() => {
    if (docId || !editable || !getPages) return
    let cancelled = false
    void getPages().then((result) => {
      if (!cancelled) setPages(result)
    })
    return () => {
      cancelled = true
    }
  }, [docId, editable, getPages])

  if (docId) {
    return (
      <button
        type="button"
        contentEditable={false}
        onClick={() => dispatchOpenDoc(docId)}
        className="my-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm underline-offset-2 hover:bg-muted"
      >
        {icon ? (
          <span className="shrink-0">{icon}</span>
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 truncate font-medium underline">
          {title || "Untitled"}
        </span>
      </button>
    )
  }
  if (!editable) return null
  return (
    <div
      contentEditable={false}
      className="my-1 w-full rounded-md border border-dashed p-2"
    >
      <p className="flex items-center gap-1.5 px-1 pb-1 text-xs text-muted-foreground">
        <Link2 className="size-3.5" /> Liên kết đến trang
      </p>
      <div className="max-h-48 overflow-y-auto">
        {pages === null ? (
          <p className="px-1 py-0.5 text-xs text-muted-foreground">Đang tải...</p>
        ) : pages.length === 0 ? (
          <p className="px-1 py-0.5 text-xs text-muted-foreground">
            Không có trang nào
          </p>
        ) : (
          pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onPick(page)}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
            >
              <span className="shrink-0">{page.icon ?? "📄"}</span>
              <span className="min-w-0 truncate">{page.title || "Untitled"}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * `getPages` is injected per-editor via this module-level ref because
 * BlockNote block specs are defined once per schema, not per instance. Set by
 * the Editor on mount (admin zone only).
 */
let getPagesRef: (() => Promise<NotionPageRef[]>) | undefined

export function setGetPages(fn?: () => Promise<NotionPageRef[]>): void {
  getPagesRef = fn
}

const LinkToPage = createReactBlockSpec(
  {
    type: "linkToPage",
    propSchema: {
      docId: { default: "" },
      title: { default: "" },
      icon: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <LinkToPageBlock
        docId={block.props.docId}
        title={block.props.title}
        icon={block.props.icon}
        editable={editor.isEditable}
        getPages={getPagesRef}
        onPick={(page) =>
          editor.updateBlock(block, {
            props: {
              docId: page.id,
              title: page.title,
              icon: page.icon ?? "",
            },
          })
        }
      />
    ),
  }
)

// ── Mention (@page / @date — Req 12.14) ──────────────────────────────────────

const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      kind: { default: "page" }, // "page" | "date"
      docId: { default: "" },
      label: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => {
      const { kind, docId, label } = inlineContent.props
      if (kind === "page" && docId) {
        return (
          <button
            type="button"
            onClick={() => dispatchOpenDoc(docId)}
            className="rounded bg-muted px-1 text-sm font-medium hover:bg-foreground/10"
          >
            📄 {label || "Untitled"}
          </button>
        )
      }
      return (
        <span className="rounded bg-muted px-1 text-sm font-medium">
          📅 {label}
        </span>
      )
    },
  }
)

// ── Schema + slash/mention menu items ────────────────────────────────────────

/** The ONE BlockNote schema both zones render (Req 12). */
export const notionSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: Callout(),
    embed: Embed(),
    linkToPage: LinkToPage(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
})

export type NotionEditor = typeof notionSchema.BlockNoteEditor

/** Custom slash-menu entries appended to BlockNote's defaults (Req 12.19). */
export function customSlashMenuItems(editor: NotionEditor) {
  return [
    {
      title: "Callout",
      subtext: "Khung nhấn mạnh với biểu tượng",
      aliases: ["callout", "chú ý", "nhấn mạnh"],
      group: "Khác",
      icon: <Lightbulb className="size-4" />,
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, { type: "callout" })
      },
    },
    {
      title: "Embed",
      subtext: "Nhúng nội dung từ URL (YouTube, Figma...)",
      aliases: ["embed", "iframe", "nhúng"],
      group: "Khác",
      icon: <MonitorPlay className="size-4" />,
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, { type: "embed" })
      },
    },
    {
      title: "Link to page",
      subtext: "Liên kết nội bộ đến một trang khác",
      aliases: ["link", "page", "trang", "liên kết"],
      group: "Khác",
      icon: <Link2 className="size-4" />,
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, { type: "linkToPage" })
      },
    },
  ]
}

/** "@" suggestion items: pages (from `getPages`) + today's date (Req 12.14). */
export async function mentionMenuItems(
  editor: NotionEditor,
  getPages?: () => Promise<NotionPageRef[]>
) {
  const pages = getPages ? await getPages().catch(() => []) : []
  const insertMention = (props: {
    kind: string
    docId: string
    label: string
  }) => {
    editor.insertInlineContent([
      { type: "mention", props },
      " ",
    ])
  }
  return [
    ...pages.map((page) => ({
      title: `${page.icon ?? "📄"} ${page.title || "Untitled"}`,
      aliases: [page.title],
      group: "Trang",
      onItemClick: () =>
        insertMention({ kind: "page", docId: page.id, label: page.title }),
    })),
    {
      title: `📅 Hôm nay — ${new Date().toLocaleDateString("vi-VN")}`,
      aliases: ["date", "ngày", "today", "hôm nay"],
      group: "Ngày",
      onItemClick: () =>
        insertMention({
          kind: "date",
          docId: "",
          label: new Date().toLocaleDateString("vi-VN"),
        }),
    },
  ]
}
