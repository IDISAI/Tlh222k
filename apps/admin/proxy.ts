import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Runs under basePath `/admin` in production only (see next.config.ts), so
// matchers/pathnames here are basePath-relative in prod (`/sign-in` matches
// the request served at `/admin/sign-in`); in dev there's no prefix to strip.
const isSignIn = createRouteMatcher(["/sign-in(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // The sign-in page itself is public (Req 5.4 exception).
  if (isSignIn(req)) return

  const { sessionClaims } = await auth()
  const claims = sessionClaims as Record<string, any> | null
  const rawRole = (claims?.metadata?.role || claims?.publicMetadata?.role) as string | undefined
  const role = rawRole ? rawRole.toLowerCase().replace("_", "-") : undefined

  // Admin zone requires admin or super-admin (Req 5.4/5.6/11.6, A1).
  if (role !== "admin" && role !== "super-admin") {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in" // basePath-relative → /admin/sign-in
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
