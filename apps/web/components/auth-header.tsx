"use client"

import { ClerkLoaded, SignInButton, UserButton, useAuth } from "@clerk/nextjs"
import { usePathname, useSearchParams } from "next/navigation"
import { authReturnUrl, devAuthRole } from "@workspace/core"

export function AuthHeader({ tone = "default" }: { tone?: "default" | "on-dark" }) {
  // Dev bypass: no <ClerkProvider>, so Clerk hooks/components would throw.
  // Show the impersonated role instead.
  const dev = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )
  if (dev !== null) {
    return (
      <span className={
        tone === "on-dark"
          ? "rounded-full border border-white/45 bg-black/65 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
          : "rounded-md border px-3 py-1 text-sm font-medium text-muted-foreground"
      }>
        dev: {dev}
      </span>
    )
  }

  return <ClerkAuthHeader tone={tone} />
}

function ClerkAuthHeader({ tone }: { tone: "default" | "on-dark" }) {
  const { isSignedIn } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Without this, Clerk sends everyone to `/` after signing in. Someone who
  // hit "Sign In" from a node they had open on a canvas would come back to the
  // home page and have to find their way there again. The viewer keeps the
  // open node and the camera in the query string precisely so this survives.
  const returnUrl = authReturnUrl(pathname, searchParams.toString())

  return (
    <ClerkLoaded>
      {isSignedIn ? (
        // Clerk's own avatar menu already carries sign-out, so a second button
        // beside it offers the same action twice and leaves the user guessing
        // whether they differ.
        <UserButton />
      ) : (
        <SignInButton
          mode="redirect"
          forceRedirectUrl={returnUrl}
          signUpForceRedirectUrl={returnUrl}
        >
          <button
            type="button"
            className={
              tone === "on-dark"
                ? "rounded-full border border-white/45 bg-black/65 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-black/80"
                : "rounded-md border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted"
            }
          >
            Sign In
          </button>
        </SignInButton>
      )}
    </ClerkLoaded>
  )
}

