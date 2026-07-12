import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { roleFromClaims } from "@workspace/core/navigation/role"

const PUBLIC_PREFIX = process.env.NODE_ENV === "production" ? "/admin" : ""

const isSignIn = createRouteMatcher(["/sign-in(.*)", "/admin/sign-in(.*)"])
const isForbidden = createRouteMatcher(["/403", "/admin/403"])

function publicPath(pathname: string) {
  if (!PUBLIC_PREFIX || pathname.startsWith(PUBLIC_PREFIX)) return pathname
  return `${PUBLIC_PREFIX}${pathname === "/" ? "" : pathname}`
}

// Admin does NOT use the dev-auth bypass (unlike web/super-admin). Two reasons:
// (1) the roadmap builder calls the authenticated svc-roadmap backend, which
// needs a real Clerk token — the bypass sends none, so write-gated queries 500;
// (2) importing `isDevAuthBypass` from the "@workspace/core" barrel drags the
// roadmap browser code (BroadcastChannel) into the Edge middleware bundle, which
// the Edge runtime rejects. Real Clerk login is required in this zone.
export default clerkMiddleware(async (auth, req) => {
  // The sign-in and forbidden pages are public (Req 1.2/1.3 exceptions).
  if (isSignIn(req) || isForbidden(req)) return

  const { userId, sessionClaims } = await auth()

  // Req 1.3: unauthenticated → Clerk sign-in, then back to the original URL.
  if (!userId) {
    const url = req.nextUrl.clone()
    url.pathname = `${PUBLIC_PREFIX}/sign-in`
    url.search = ""
    url.searchParams.set(
      "redirect_url",
      publicPath(req.nextUrl.pathname) + req.nextUrl.search
    )
    return NextResponse.redirect(url)
  }

  // Req 1.2: authenticated viewers are forbidden, not re-prompted.
  const role = roleFromClaims(sessionClaims)
  if (role !== "admin" && role !== "super-admin") {
    const url = req.nextUrl.clone()
    url.pathname = `${PUBLIC_PREFIX}/403`
    url.search = ""
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: [
    "/((?!_next|.*\\.[^/]+$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
    "/_clerk/(.*)",
  ],
}
