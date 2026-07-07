import { Geist_Mono, Inter } from "next/font/google"
import { ClerkProvider, UserButton } from "@clerk/nextjs"

import { PlatformSwitch, ThemeToggle } from "@workspace/core"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { getIsAuthenticated, getRole } from "@/lib/auth"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// Dev bypass: skip <ClerkProvider> + Clerk client widgets so the localhost-only
// preview / headless QA isn't blocked loading Clerk's external hosted JS.
const DEV_BYPASS =
  process.env.NODE_ENV !== "production"
    ? process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
    : undefined

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [role, isAuthed] = await Promise.all([
    getRole(),
    getIsAuthenticated(),
  ])

  const document = (
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
        <ThemeProvider>
          <header className="flex items-center justify-between border-b p-3">
            <PlatformSwitch
              current="admin"
              role={role}
              baseUrl={process.env.NEXT_PUBLIC_HOST_URL ?? ""}
            />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {DEV_BYPASS ? (
                <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  dev: {role}
                </span>
              ) : (
                isAuthed && <UserButton />
              )}
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )

  // In bypass mode render without ClerkProvider — no external Clerk JS at all.
  return DEV_BYPASS ? document : <ClerkProvider>{document}</ClerkProvider>
}
