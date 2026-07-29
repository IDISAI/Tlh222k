"use client"

import { useState } from "react"
import { ImageIcon } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

interface CoverUploadFieldProps {
  id: string
  label: string
  imageUrl: string | null
  /** Shown inside the preview box while no image is set. */
  placeholderHint: string
  helpText: string
  aspectClassName?: string
  disabled?: boolean
  accept?: string
  /** Validates and persists the file (Blob upload), returning the new URL. */
  upload: (file: File) => Promise<string>
  onUploaded: (url: string) => void
}

/**
 * Shared cover-image upload control: the whole dashed preview box is a
 * `<label>` for a visually-hidden file input, so clicking anywhere on it
 * opens the file picker — no separate "Choose File" control to show. A
 * "paste a URL instead" fallback sets the cover directly, skipping the
 * upload/policy path entirely (same as pointing at an image hosted
 * elsewhere already). Validation and the Blob upload itself stay in the
 * caller's `upload` function so this component stays policy-agnostic.
 * Built for the Field Workspace cover, reused by the roadmap block create
 * dialog (#48).
 */
export function CoverUploadField({
  id,
  label,
  imageUrl,
  placeholderHint,
  helpText,
  aspectClassName = "aspect-[3/1.15]",
  disabled,
  accept = "image/jpeg,image/webp",
  upload,
  onUploaded,
}: CoverUploadFieldProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [pastingUrl, setPastingUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState("")

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const url = await upload(file)
      onUploaded(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh lên.")
    } finally {
      setBusy(false)
    }
  }

  const submitUrl = () => {
    const url = urlDraft.trim()
    if (!/^https?:\/\//i.test(url)) {
      setError("URL ảnh phải bắt đầu bằng http:// hoặc https://")
      return
    }
    setError("")
    onUploaded(url)
    setUrlDraft("")
    setPastingUrl(false)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed bg-muted/35 text-center text-xs text-muted-foreground transition hover:bg-muted/60",
          disabled || busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          aspectClassName
        )}
        style={
          imageUrl
            ? {
                backgroundImage: `linear-gradient(#0006,#0006),url(${imageUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                color: "white",
              }
            : undefined
        }
      >
        <span>
          <ImageIcon className="mx-auto mb-1 size-5" />
          {busy ? "Đang tải…" : imageUrl ? "Bấm để đổi ảnh" : placeholderHint}
        </span>
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={disabled || busy}
          onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
          className="sr-only"
        />
      </label>

      {pastingUrl ? (
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={urlDraft}
            disabled={disabled || busy}
            placeholder="https://…"
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submitUrl()
              }
              if (event.key === "Escape") {
                setPastingUrl(false)
                setUrlDraft("")
              }
            }}
            className="h-9 text-xs"
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={submitUrl}
            className="shrink-0 rounded-md border px-3 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Dùng URL
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => setPastingUrl(true)}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Hoặc dán URL ảnh
        </button>
      )}

      <p className="text-xs text-muted-foreground">{helpText}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
