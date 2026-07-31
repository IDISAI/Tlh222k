import { svcApiUrl } from "@workspace/core"

export async function POST(request: Request) {
  const baseUrl = svcApiUrl()
  if (!baseUrl) {
    return Response.json(
      { errors: [{ message: "svc-api URL is not configured" }] },
      { status: 502 }
    )
  }

  const targetUrl = `${baseUrl.replace(/\/$/, "")}/graphql`
  const body = await request.text()

  const headers: Record<string, string> = {
    "content-type": request.headers.get("content-type") || "application/json",
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    headers["authorization"] = authHeader
  }

  const bypassSecret = process.env.SVC_API_AUTOMATION_BYPASS_SECRET
  if (bypassSecret) {
    headers["x-vercel-protection-bypass"] = bypassSecret
  }

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    })

    const data = await res.text()
    return new Response(data, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    })
  } catch (error) {
    return Response.json(
      {
        errors: [
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to proxy GraphQL request",
          },
        ],
      },
      { status: 502 }
    )
  }
}
