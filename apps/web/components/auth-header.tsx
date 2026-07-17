"use client"

import { ClerkLoaded, SignInButton, UserButton, useAuth } from "@clerk/nextjs"
import { devAuthRole } from "@workspace/core"

export function AuthHeader() {
  // Dev bypass: no <ClerkProvider>, so Clerk hooks/components would throw.
  // Show the impersonated role instead.
  const dev = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
  )
  if (dev !== null) {
    return (
      <span className="rounded-md border px-3 py-1 text-sm font-medium text-muted-foreground">
        dev: {dev}
      </span>
    )
  }

  return <ClerkAuthHeader />
}

function ClerkAuthHeader() {
  const { isSignedIn } = useAuth()

  return (
    <ClerkLoaded>
      {isSignedIn ? (
        <UserButton />
      ) : (
        <SignInButton mode="redirect">
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted"
          >
            Sign In
          </button>
        </SignInButton>
      )}
    </ClerkLoaded>
  )
}

