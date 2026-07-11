"use client"

import { ClerkLoaded, SignInButton, UserButton, useAuth } from "@clerk/nextjs"

export function AuthHeader() {
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

