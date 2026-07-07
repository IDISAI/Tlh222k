import { getMockMarkdown } from "@workspace/core"

// Same-origin proxy for node content (keeps svc-notion off the browser).
// Mock-backed for now; ponytail: fetch `${process.env.SVC_NOTION_URL}/notion/
// ${pageId}` with `AbortSignal.timeout(10_000)` once svc-notion exists.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await ctx.params
  const markdown = getMockMarkdown(pageId)

  if (markdown === null) {
    return Response.json(
      { error: "Page not found", code: "NOT_FOUND" },
      { status: 404 }
    )
  }
  return Response.json({ markdown })
}
