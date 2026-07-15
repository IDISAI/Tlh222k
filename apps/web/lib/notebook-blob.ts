// Read-only Blob access for the web viewer (server-only). The admin editor
// writes notebooks as `notebooks/<slug>.json` blobs in a PRIVATE store; here we
// read the published ones via the authenticated get() so /notebooks serves
// admin-authored content without the kernel-server.
import { get } from "@vercel/blob"

const PREFIX = "notebooks/"
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

interface NotebookBlob {
  published: boolean
  notebook: unknown
}

/** Fetch a published notebook's serialized .ipynb object, or null. */
export async function loadPublishedFromBlob(slug: string): Promise<unknown | null> {
  const token =
    process.env.NOTEBOOK_BLOB_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN
  if (!token || !SLUG_PATTERN.test(slug)) return null
  try {
    const result = await get(`${PREFIX}${slug}.json`, {
      access: "private",
      token,
      useCache: false,
    })
    if (!result || !result.stream) return null
    const data = (await new Response(result.stream).json()) as NotebookBlob
    return data.published ? data.notebook : null
  } catch {
    return null // Blob unavailable → caller falls back to committed fixtures
  }
}
