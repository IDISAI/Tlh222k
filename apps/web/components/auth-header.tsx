"use client"

import { ClerkLoaded, SignInButton, SignOutButton, UserButton, useAuth } from "@clerk/nextjs"
import { devAuthRole } from "@workspace/core"

export function AuthHeader({ tone = "default" }: { tone?: "default" | "on-dark" }) {
  // Dev bypass: no <ClerkProvider>, so Clerk hooks/components would throw.
  // Show the impersonated role instead.
  const dev = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
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

  return (
    <ClerkLoaded>
      {isSignedIn ? (
        <span className="flex items-center gap-1.5">
          <UserButton />
          <SignOutButton>
            <button
              type="button"
              className={
                tone === "on-dark"
                  ? "rounded-full border border-white/45 bg-black/65 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-black/80"
                  : "rounded-md border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted"
              }
            >
              Đăng xuất
            </button>
          </SignOutButton>
        </span>
      ) : (
        <SignInButton mode="redirect">
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

