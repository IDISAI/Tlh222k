import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Runs under basePath `/super-admin` in production only (see next.config.ts),
// so matchers/pathnames are basePath-relative in prod (`/sign-in` matches the
// request served at `/super-admin/sign-in`); in dev there's no prefix to strip.
const isSignIn = createRouteMatcher(["/sign-in(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // The sign-in page itself is public (Req 12.4 exception).
  if (isSignIn(req)) return

  const { sessionClaims } = await auth()
  const claims = sessionClaims as Record<string, any> | null
  const rawRole = (claims?.metadata?.role || claims?.publicMetadata?.role) as string | undefined
  const role = rawRole ? rawRole.toLowerCase().replace("_", "-") : undefined

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
