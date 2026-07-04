import { NextResponse, type NextRequest } from "next/server"

// ponytail: cookie-presence gate for UX only — real enforcement lives in
// svc-notion (JWT verified per GraphQL request). Paths here are basePath-free.
const PUBLIC_PREFIXES = ["/login", "/register", "/api/auth", "/p/"]

export function proxy(request: NextRequest) {
  const { pathname, basePath } = request.nextUrl
  const path = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || "/"
    : pathname

  const isPublic = PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token")

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL(`${basePath}/login`, request.url))
  }
  return NextResponse.next()
}

export const config = {
  // skip static assets & uploads webhook
  matcher: ["/((?!_next|favicon.ico|api/uploadthing).*)"],
}
