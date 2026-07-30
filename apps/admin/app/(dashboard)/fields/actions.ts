"use server"

import { del, put } from "@vercel/blob"

import { getRole } from "@/lib/auth"
import { inspectFieldImage } from "./field-image-policy"

/** Uploads only Field Explorer covers. File dimensions are decoded client-side;
 * server repeats authorization, MIME and byte-size enforcement before Blob. */
export async function uploadFieldCover(form: FormData): Promise<{ url: string }> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") throw new Error("PERMISSION_DENIED")
  const file = form.get("file")
  if (!(file instanceof File)) throw new Error("NO_FILE")
  const policy = inspectFieldImage(file)
  if (!policy.ok) throw new Error(policy.code)
  const blob = await put(`fields/${crypto.randomUUID()}-${policy.sanitizedName}`, file, {
    access: "public",
    contentType: policy.contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return { url: blob.url }
}

/**
 * Replace a Field cover: uploads the new image then deletes the previous one.
 * Best-effort on the delete — an orphaned file must not fail the action, since
 * the new upload already succeeded (#47: the Field's image is cleaned up when
 * it is replaced).
 */
export async function replaceFieldCover(form: FormData, previousUrl: string | null): Promise<{ url: string }> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") throw new Error("PERMISSION_DENIED")
  const file = form.get("file")
  if (!(file instanceof File)) throw new Error("NO_FILE")
  const policy = inspectFieldImage(file)
  if (!policy.ok) throw new Error(policy.code)
  const blob = await put(`fields/${crypto.randomUUID()}-${policy.sanitizedName}`, file, {
    access: "public",
    contentType: policy.contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  if (previousUrl) {
    await del(previousUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {})
  }
  return { url: blob.url }
}

/**
 * Delete a Field cover blob outright. Used when a Field is deleted: the Field's
 * image is cleaned up when the Field is deleted (#47). Best-effort, so a Blob
 * that has already been removed does not fail the deletion.
 */
export async function deleteFieldCover(url: string | null): Promise<{ ok: true }> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") throw new Error("PERMISSION_DENIED")
  if (url) await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {})
  return { ok: true }
}
