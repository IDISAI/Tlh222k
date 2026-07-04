import { decode } from "@auth/core/jwt"

export interface GraphQLContext {
  userId: string | null
}

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

/**
 * Auth.js v5 session JWT (JWE) — same AUTH_SECRET as the admin app.
 * localhost:3002 → :3004 is same-site, so the session cookie rides along on
 * fetch(credentials: "include"). Authorization: Bearer works as fallback.
 */
export async function buildContext(request: Request): Promise<GraphQLContext> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return { userId: null }

  const cookieHeader = request.headers.get("cookie") ?? undefined
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  for (const salt of SESSION_COOKIES) {
    const token = cookieValue(cookieHeader, salt) ?? (salt === SESSION_COOKIES[0] ? bearer : null)
    if (!token) continue
    try {
      const decoded = await decode({ token, secret, salt })
      if (decoded?.sub) return { userId: decoded.sub }
    } catch {
      // invalid/expired token → anonymous
    }
  }
  return { userId: null }
}
