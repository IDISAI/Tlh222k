import { ClerkProvider } from "@clerk/nextjs"

import { devAuthRole, ReloadOnBackForward } from "@workspace/core"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Separate root layout for /sign-in — a sibling of (dashboard)'s root layout,
 * not nested under it. The dashboard layout always renders AdminSidebar +
 * AdminBreadcrumb around `children`, which used to leak onto /sign-in (the
 * Clerk widget rendered floating over the dashboard chrome, since a single
 * shared root layout has no way to skip chrome per-route). Route groups give
 * each top-level segment its own <html>/<body>, so this one stays bare.
 */
export default async function AuthRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const devBypass = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )

  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans")}
    >
      <body>
        <ReloadOnBackForward />
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )

  return devBypass ? tree : <ClerkProvider dynamic>{tree}</ClerkProvider>
}
