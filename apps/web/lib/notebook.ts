// Fixture-backed notebook loading for /learn/[slug] (Phase 1). The kernel-server
// CRUD store replaces this file's fs reads in Phase 2 — keep the API shape.
import { promises as fs } from "node:fs"
import path from "node:path"

import { NotebookService, type Notebook } from "@workspace/core"

import { loadPublishedFromBlob } from "./notebook-blob"

const service = new NotebookService()
const CONTENT_DIR = path.join(process.cwd(), "content", "notebooks")

// Slugs come from the URL — never let them traverse out of CONTENT_DIR.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

// Admin-authored notebooks live in Vercel Blob (`notebooks/<slug>.json`). Web
// reads the PUBLISHED ones directly server-side; committed fixtures remain the
// fallback for the seeded roadmap notebooks.
async function fetchPublished(slug: string): Promise<Notebook | null> {
  const notebook = await loadPublishedFromBlob(slug)
  if (notebook === null) return null
  try {
    return service.parse(notebook)
  } catch {
    return null
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
  // Admin-published exercise wins over committed fixtures.
  return (
    (await fetchPublished(`${slug}-exercise`)) ??
    (await readNotebook(`${slug}.exercise.ipynb`))
  )
}
