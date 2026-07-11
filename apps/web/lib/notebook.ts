// Fixture-backed notebook loading for /learn/[slug] (Phase 1). The kernel-server
// CRUD store replaces this file's fs reads in Phase 2 — keep the API shape.
import { promises as fs } from "node:fs"
import path from "node:path"

import { NotebookService, type Notebook } from "@workspace/core"

const service = new NotebookService()
const CONTENT_DIR = path.join(process.cwd(), "content", "notebooks")

// Slugs come from the URL — never let them traverse out of CONTENT_DIR.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

// kernel-server holds notebooks authored in the admin editor. Web reads the
// PUBLIC published endpoint (server-to-server, no token). Committed fixtures
// remain the fallback for the seeded roadmap notebooks.
const KERNEL_SERVER_URL = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL

async function fetchPublished(slug: string): Promise<Notebook | null> {
  if (!KERNEL_SERVER_URL) return null
  try {
    const res = await fetch(`${KERNEL_SERVER_URL}/api/published/${slug}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const { notebook } = (await res.json()) as { notebook: unknown }
    return service.parse(notebook)
  } catch {
    return null // kernel-server down → fall back to fixtures
  }
}

async function readNotebook(fileName: string): Promise<Notebook | null> {
  const filePath = path.join(CONTENT_DIR, fileName)
  let raw: string
  try {
    raw = await fs.readFile(filePath, "utf8")
  } catch {
    return null // unknown slug → 404 upstream
  }
  try {
    return service.parse(raw)
  } catch (error) {
    console.error(`Failed to parse notebook fixture ${fileName}:`, error)
    return null
  }
}

/** The read-only tutorial notebook shown in the Tutorial tab. */
export async function loadTutorialNotebook(
  slug: string
): Promise<Notebook | null> {
  if (!SLUG_PATTERN.test(slug)) return null
  // Admin-authored notebooks (kernel-server) win over committed fixtures.
  return (await fetchPublished(slug)) ?? (await readNotebook(`${slug}.ipynb`))
}

/** The companion exercise notebook (Exercise tab; executed in Phase 3). */
export async function loadExerciseNotebook(
  slug: string
): Promise<Notebook | null> {
  if (!SLUG_PATTERN.test(slug)) return null
  return readNotebook(`${slug}.exercise.ipynb`)
}
