import { Geist_Mono, Inter } from "next/font/google"
import { ClerkLoaded, ClerkProvider, UserButton } from "@clerk/nextjs"

import { devAuthRole, ReloadOnBackForward, RoadmapApolloProvider, ThemeToggle } from "@workspace/core"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { getIsAuthenticated } from "@/lib/auth"
import { USERS_PATH } from "@/lib/paths"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isAuthed = await getIsAuthenticated()
  const devBypass = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
  )

  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ReloadOnBackForward />
        <ThemeProvider>
          <header className="flex items-center justify-between border-b p-3">
            <a
              href={USERS_PATH}
              className="font-heading text-sm font-bold uppercase italic"
            >
              Super Admin
            </a>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {devBypass !== null ? (
                <span className="rounded-md border px-3 py-1 text-sm font-medium text-muted-foreground">
                  dev: {devBypass}
                </span>
              ) : (
                isAuthed && (
                  <ClerkLoaded>
                    <UserButton />
                  </ClerkLoaded>
                )
              )}
            </div>
          </header>
          <RoadmapApolloProvider>{children}</RoadmapApolloProvider>
        </ThemeProvider>
      </body>
    </html>
  )

  // `dynamic`: render Clerk at request time so the statically prerendered
  // /_not-found boundary doesn't call auth() without middleware context.
  return devBypass ? tree : <ClerkProvider dynamic>{tree}</ClerkProvider>
}
