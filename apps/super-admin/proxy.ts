import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { devAuthRole, roleFromClaims } from "@workspace/core/navigation/role"

const PUBLIC_PREFIX =
  process.env.NODE_ENV === "production" ? "/super-admin" : ""
const devRole = devAuthRole(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
)

const isSignIn = createRouteMatcher([
  "/sign-in(.*)",
  "/super-admin/sign-in(.*)",
])

function publicPath(pathname: string) {
  if (!PUBLIC_PREFIX || pathname.startsWith(PUBLIC_PREFIX)) return pathname
  return `${PUBLIC_PREFIX}${pathname === "/" ? "" : pathname}`
}

export default clerkMiddleware(async (auth, req) => {
  // The sign-in page itself is public (Req 12.4 exception).
  if (isSignIn(req)) return

  if (devRole === "super-admin") return
  if (devRole) {
    const url = req.nextUrl.clone()
    url.pathname = `${PUBLIC_PREFIX}/sign-in`
    url.search = ""
    return NextResponse.redirect(url)
  }

  const { userId, sessionClaims } = await auth()

  // Unauthenticated → Clerk sign-in, preserving the return path.
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

  // Super-Admin zone requires super-admin only (Req 12.4).
  const role = roleFromClaims(sessionClaims)
  if (role !== "super-admin") {
    const url = req.nextUrl.clone()
    url.pathname = `${PUBLIC_PREFIX}/sign-in`
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
