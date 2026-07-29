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
 * Shared cover-image upload control: a dashed preview box plus a file input,
 * delegating validation and the Blob upload itself to the caller's `upload`
 * function so this component stays policy-agnostic. Built for the Field
 * Workspace cover, reused by the roadmap block create dialog (#48).
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

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <span
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed bg-muted/35 text-center text-xs text-muted-foreground",
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
          {busy ? "Đang tải…" : imageUrl ? "Ảnh đang dùng" : placeholderHint}
        </span>
      </span>
      <Input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled || busy}
        onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
        className="h-10 cursor-pointer pt-1.5"
      />
      <p className="text-xs text-muted-foreground">{helpText}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
