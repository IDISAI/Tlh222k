import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Next.js 16: request-time logic lives in `proxy.ts` (renamed from middleware).
// This is an *optimistic* gate — protected pages must still verify server-side.
const isProtected = createRouteMatcher(["/dashboard(.*)"])
const isAuthPage = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"])

// Dev-only auth bypass for headless QA / the localhost-only preview (can't open
// Clerk's hosted sign-in). Set DEV_AUTH_ROLE in .env.local; off in production.
const DEV_AUTH_ROLE =
  process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_DEV_AUTH_ROLE : undefined

export default clerkMiddleware(async (auth, req) => {
  const userId = DEV_AUTH_ROLE ? "dev-bypass" : (await auth()).userId

  // Already signed in and visiting the auth pages → /roadmaps (Req 4.6).
  if (userId && isAuthPage(req)) {
    const url = req.nextUrl.clone()
    url.pathname = "/roadmaps"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Guest hitting a protected route → sign-in, preserving return path (Req 4.5 / 8.6).
  // Clerk's <SignIn> natively honours the `redirect_url` query param → round-trip (A2).
  if (!userId && isProtected(req)) {
    const url = req.nextUrl.clone()
    const returnTo = url.pathname + url.search
    url.pathname = "/sign-in"
    url.search = ""
    url.searchParams.set("redirect_url", returnTo)
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: [
    // Everything except Next internals, the child zones (they self-guard), and
    // files with an extension. Always run on API routes.
    "/((?!_next|admin|super-admin|.*\\.[^/]+$).*)",
    "/(api|trpc)(.*)",
  ],
}
