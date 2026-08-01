import { ClerkLoaded, ClerkProvider, UserButton } from "@clerk/nextjs"

import {
  devAuthRole,
  ReloadOnBackForward,
  RoadmapApolloProvider,
  ThemeToggle,
} from "@workspace/core"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AdminBreadcrumb } from "@/components/admin-navigation"
import { AdminSidebar } from "@/components/admin-sidebar"
import { cn } from "@workspace/ui/lib/utils"
import { getIsAuthenticated, getRole } from "@/lib/auth"

export default async function DashboardRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isAuthed = await getIsAuthenticated()
  const devBypass = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )
  const role = isAuthed ? await getRole() : devBypass

  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans")}
    >
      <body>
        <ReloadOnBackForward />
        <ThemeProvider>
          <div className="flex min-h-screen bg-background">
            <AdminSidebar role={role} />
            <div className="min-w-0 flex-1">
              <header className="flex h-16 items-center justify-between border-b px-5 lg:px-7">
                <AdminBreadcrumb />
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  {isAuthed ? (
                    <ClerkLoaded>
                      <UserButton />
                    </ClerkLoaded>
                  ) : devBypass !== null ? (
                    <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                      {devBypass}
                    </span>
                  ) : null}
                </div>
              </header>
              <RoadmapApolloProvider>{children}</RoadmapApolloProvider>
            </div>
          </div>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )

  // `dynamic`: render Clerk at request time so the statically prerendered
  // /_not-found boundary doesn't call auth() without middleware context.
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider dynamic>{tree}</ClerkProvider>
  ) : (
    tree
  )
}
