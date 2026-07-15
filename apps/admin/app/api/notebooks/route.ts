import { getRole } from "@/lib/auth"
import { listNotebooks } from "@/lib/notebook-blob"

// GET /api/notebooks — admin-only list of all notebooks (Blob-backed).
export async function GET() {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }
  try {
    return Response.json(await listNotebooks())
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "list failed" },
      { status: 500 }
    )
  }
}
