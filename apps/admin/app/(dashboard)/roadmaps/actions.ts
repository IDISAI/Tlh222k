"use server"

import { put } from "@vercel/blob"

import { getRole } from "@/lib/auth"
import { inspectBlockCoverImage } from "./block-cover-policy"

/** Uploads a roadmap block's cover image. Dimensions are decoded client-side;
 * server repeats authorization, MIME and byte-size enforcement before Blob. */
export async function uploadBlockCover(form: FormData): Promise<{ url: string }> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") throw new Error("PERMISSION_DENIED")
  const file = form.get("file")
  if (!(file instanceof File)) throw new Error("NO_FILE")
  const policy = inspectBlockCoverImage(file)
  if (!policy.ok) throw new Error(policy.code)
  const blob = await put(`roadmap-blocks/${crypto.randomUUID()}-${policy.sanitizedName}`, file, {
    access: "public",
    contentType: policy.contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return { url: blob.url }
}
