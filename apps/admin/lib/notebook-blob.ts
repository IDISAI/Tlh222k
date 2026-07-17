// Vercel Blob-backed notebook store (server-only). Replaces the Go kernel-server
// CRUD in production: notebooks persist as `notebooks/<slug>.json` blobs so the
// admin editor can author/publish free on Vercel, and the web viewer reads the
// same published blobs. The store is PRIVATE (access:'private'); reads go through
// the authenticated `get()` so there are no public URLs and no CDN staleness.
import { del, get, list, put } from "@vercel/blob"

const PREFIX = "notebooks/"
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export type RuntimeProfile = "data-science" | "ml-cpu"

interface NotebookBlob {
  slug: string
  title: string
  updatedAt: string
  published: boolean
  runtimeProfile: RuntimeProfile
  notebook: unknown // serialized .ipynb object
}

export interface NotebookSummary {
  slug: string
  title: string
  updatedAt: string
  published: boolean
  runtimeProfile: RuntimeProfile
}

interface NotebookMeta {
  published: boolean
  runtimeProfile: RuntimeProfile
  updatedAt: string
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}

// A dedicated token so admin (write) and web (read) share ONE Blob store,
// independent of each app's other BLOB_READ_WRITE_TOKEN usage.
function token(): string {
  const t = process.env.NOTEBOOK_BLOB_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN
  if (!t) throw new Error("NOTEBOOK_BLOB_TOKEN is not set")
  return t
}

function pathFor(slug: string): string {
  return `${PREFIX}${slug}.json`
}

function normProfile(p: unknown): RuntimeProfile {
  return p === "ml-cpu" ? "ml-cpu" : "data-science"
}

async function readBlob(slug: string): Promise<NotebookBlob | null> {
  if (!isValidSlug(slug)) return null
  const result = await get(pathFor(slug), {
    access: "private",
    token: token(),
    useCache: false,
  })
  if (!result || !result.stream) return null
  const data = (await new Response(result.stream).json()) as NotebookBlob
  return { ...data, runtimeProfile: normProfile(data.runtimeProfile) }
}

export interface SaveInput {
  title: string
  published: boolean
  runtimeProfile: RuntimeProfile
  notebook: unknown
}

export async function saveNotebook(
  slug: string,
  input: SaveInput
): Promise<NotebookSummary> {
  const record: NotebookBlob = {
    slug,
    title: input.title,
    updatedAt: new Date().toISOString(),
    published: input.published,
    runtimeProfile: normProfile(input.runtimeProfile),
    notebook: input.notebook,
  }
  await put(pathFor(slug), JSON.stringify(record), {
    access: "private",
    token: token(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  })
  return summaryOf(record)
}

export async function loadNotebook(
  slug: string
): Promise<{ notebook: unknown; meta: NotebookMeta } | null> {
  const b = await readBlob(slug)
  if (!b) return null
  return { notebook: b.notebook, meta: metaOf(b) }
}

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const { blobs } = await list({ prefix: PREFIX, token: token() })
  const records = await Promise.all(
    blobs.map(async (b) => {
      const slug = b.pathname.slice(PREFIX.length).replace(/\.json$/, "")
      try {
        return await readBlob(slug)
      } catch {
        return null
      }
    })
  )
  return records
    .filter((r): r is NotebookBlob => r !== null)
    .map(summaryOf)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteNotebook(slug: string): Promise<void> {
  if (!isValidSlug(slug)) return
  await del(pathFor(slug), { token: token() })
}

function metaOf(b: NotebookBlob): NotebookMeta {
  return {
    published: b.published,
    runtimeProfile: b.runtimeProfile,
    updatedAt: b.updatedAt,
  }
}

function summaryOf(b: NotebookBlob): NotebookSummary {
  return {
    slug: b.slug,
    title: b.title,
    updatedAt: b.updatedAt,
    published: b.published,
    runtimeProfile: b.runtimeProfile,
  }
}
