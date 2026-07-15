import { getRole } from "@/lib/auth"
import {
  deleteNotebook,
  isValidSlug,
  loadNotebook,
  saveNotebook,
  type RuntimeProfile,
} from "@/lib/notebook-blob"

async function requireAdmin(): Promise<Response | null> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }
  return null
}

// GET /api/notebooks/[slug] — admin-only single notebook.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied
  const { slug } = await ctx.params
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 })
  }
  const record = await loadNotebook(slug)
  if (!record) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json(record)
}

interface PutBody {
  title?: string
  published?: boolean
  runtimeProfile?: string
  notebook?: unknown
}

// PUT /api/notebooks/[slug] — create/update. Publication defaults to draft.
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied
  const { slug } = await ctx.params
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 })
  }
  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 })
  }
  if (body.notebook == null) {
    return Response.json({ error: "missing notebook" }, { status: 400 })
  }
  const profile: RuntimeProfile =
    body.runtimeProfile === "ml-cpu" ? "ml-cpu" : "data-science"
  try {
    const meta = await saveNotebook(slug, {
      title: body.title ?? "Untitled notebook",
      published: body.published === true,
      runtimeProfile: profile,
      notebook: body.notebook,
    })
    return Response.json(meta)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 }
    )
  }
}

// DELETE /api/notebooks/[slug]
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied
  const { slug } = await ctx.params
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 })
  }
  try {
    await deleteNotebook(slug)
    return new Response(null, { status: 204 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 }
    )
  }
}
