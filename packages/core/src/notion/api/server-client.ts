// Server-side GraphQL transport for the Notion domain. Runs inside Next Server
// Actions (no `window`, so the browser Apollo client can't apply). The caller
// passes the auth token it resolved from Clerk `auth().getToken()` (or the
// `dev:<role>` bypass in development); public reads pass null.
import { NotionConnectionError, NotionServiceError, type NotionErrorCode } from "../types"

// NEXT_PUBLIC_SVC_ROADMAP_URL is the legacy name kept as a fallback so existing
// .env.local / Vercel envs keep working after the svc-roadmap → svc-api rename.
function svcApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SVC_API_URL ??
    process.env.NEXT_PUBLIC_SVC_ROADMAP_URL ??
    ""
  )
}

export function notionBackendEnabled(): boolean {
  return Boolean(svcApiUrl())
}

function endpoint(): string {
  return `${svcApiUrl().replace(/\/$/, "")}/graphql`
}

interface GraphQLError {
  message: string
  extensions?: { code?: string }
}

export async function notionGql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string | null
): Promise<T> {
  let res: Response
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      // Never cache authenticated writes/reads across users or requests.
      cache: "no-store",
    })
  } catch (error) {
    // Network / DNS / connection failure (Neon cold start, svc-api down).
    // Re-throw as a distinguishable error so callers can show "connection
    // error" instead of "content not available".
    throw new NotionConnectionError(
      error instanceof Error ? error.message : "Network error"
    )
  }

  let json: { data?: T; errors?: GraphQLError[] }
  try {
    json = (await res.json()) as { data?: T; errors?: GraphQLError[] }
  } catch {
    throw new NotionConnectionError(
      `svc-api returned non-JSON (status ${res.status})`
    )
  }

  if (json.errors?.length) {
    const code = json.errors[0]?.extensions?.code
    const known: NotionErrorCode =
      code === "PERMISSION_DENIED" ? "PERMISSION_DENIED" : "NOT_FOUND"
    throw new NotionServiceError(known, json.errors[0]?.message)
  }
  return json.data as T
}

