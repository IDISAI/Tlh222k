"use server"

import { put } from "@vercel/blob"

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
