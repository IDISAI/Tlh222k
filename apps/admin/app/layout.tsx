import { Geist_Mono, Inter } from "next/font/google"
import { ClerkLoaded, ClerkProvider, UserButton } from "@clerk/nextjs"

import { RoadmapApolloProvider, ThemeToggle } from "@workspace/core"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { getIsAuthenticated } from "@/lib/auth"
import { ROADMAPS_PATH } from "@/lib/paths"

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

  return (
    <ClerkProvider>
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
              <a
                href={ROADMAPS_PATH}
                className="font-heading text-sm font-bold uppercase italic"
              >
                Roadmap CMS
              </a>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {/* UserButton is a prebuilt Clerk UI component — it throws
                    "Clerk was not loaded with Ui components" if it mounts
                    before clerk-js finishes loading its UI bundle. That race
                    bites hardest here because the multi-zone assetPrefix
                    (:3002) loads clerk-js cross-origin. ClerkLoaded gates the
                    render until the UI bundle is ready (same guard as web's
                    auth-header). */}
                {isAuthed && (
                  <ClerkLoaded>
                    <UserButton />
                  </ClerkLoaded>
                )}
              </div>
            </header>
            <RoadmapApolloProvider>{children}</RoadmapApolloProvider>
            <Toaster richColors closeButton />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
