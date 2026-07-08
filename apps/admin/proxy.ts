import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { roleFromClaims } from "@workspace/core/navigation/role"

// Runs under basePath `/admin` in production only (see next.config.ts), so
// matchers/pathnames here are basePath-relative in prod (`/sign-in` matches
// the request served at `/admin/sign-in`); in dev there's no prefix to strip.
const isSignIn = createRouteMatcher(["/sign-in(.*)"])
const isForbidden = createRouteMatcher(["/403"])

export default clerkMiddleware(async (auth, req) => {
  // The sign-in and forbidden pages are public (Req 1.2/1.3 exceptions).
  if (isSignIn(req) || isForbidden(req)) return

  const { userId, sessionClaims } = await auth()

  // Req 1.3: unauthenticated → Clerk sign-in, then back to the original URL.
  if (!userId) {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in" // basePath-relative → /admin/sign-in in prod
    url.search = ""
    url.searchParams.set(
      "redirect_url",
      req.nextUrl.pathname + req.nextUrl.search
    )
    return NextResponse.redirect(url)
  }

  // Req 1.2: authenticated viewers are forbidden, not re-prompted.
  const role = roleFromClaims(sessionClaims)
  if (role !== "admin" && role !== "super-admin") {
    const url = req.nextUrl.clone()
    url.pathname = "/403"
    url.search = ""
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: ["/((?!_next|.*\\.[^/]+$).*)", "/(api|trpc)(.*)"],
}
