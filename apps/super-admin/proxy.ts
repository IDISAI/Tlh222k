import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { normalizeRole, roleFromClaims } from "@workspace/core/navigation/role"

// Runs under basePath `/super-admin` in production only (see next.config.ts),
// so matchers/pathnames are basePath-relative in prod (`/sign-in` matches the
// request served at `/super-admin/sign-in`); in dev there's no prefix to strip.
const isSignIn = createRouteMatcher(["/sign-in(.*)"])

// Dev-only auth bypass for headless QA / the localhost-only preview (can't open
// Clerk's hosted sign-in). Set DEV_AUTH_ROLE in .env.local; off in production.
const DEV_AUTH_ROLE =
  process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_DEV_AUTH_ROLE : undefined

export default clerkMiddleware(async (auth, req) => {
  // The sign-in page itself is public (Req 12.4 exception).
  if (isSignIn(req)) return

  const role = DEV_AUTH_ROLE
    ? normalizeRole(DEV_AUTH_ROLE)
    : roleFromClaims((await auth()).sessionClaims)

  // Super-Admin zone requires super-admin only (Req 12.4).
  if (role !== "super-admin") {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in" // basePath-relative → /super-admin/sign-in
    url.search = ""
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: [
    "/((?!_next|.*\\.[^/]+$).*)",
    "/(api|trpc)(.*)",
  ],
}
