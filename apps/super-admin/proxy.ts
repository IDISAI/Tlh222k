import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { roleFromClaims } from "@workspace/core/navigation/role"

// Runs under basePath `/super-admin` in production only (see next.config.ts),
// so matchers/pathnames are basePath-relative in prod (`/sign-in` matches the
// request served at `/super-admin/sign-in`); in dev there's no prefix to strip.
const isSignIn = createRouteMatcher(["/sign-in(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // The sign-in page itself is public (Req 12.4 exception).
  if (isSignIn(req)) return

  const { userId, sessionClaims } = await auth()

  // Unauthenticated → Clerk sign-in, preserving the return path.
  if (!userId) {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in" // basePath-relative → /super-admin/sign-in
    url.search = ""
    url.searchParams.set(
      "redirect_url",
      req.nextUrl.pathname + req.nextUrl.search
    )
    return NextResponse.redirect(url)
  }

  // Super-Admin zone requires super-admin only (Req 12.4).
  const role = roleFromClaims(sessionClaims)
  if (role !== "super-admin") {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in"
    url.search = ""
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: ["/((?!_next|.*\\.[^/]+$).*)", "/(api|trpc)(.*)"],
}
