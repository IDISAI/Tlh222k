import { Geist_Mono, Inter } from "next/font/google"
import { ClerkLoaded, ClerkProvider, UserButton } from "@clerk/nextjs"

import { RoadmapApolloProvider, ThemeToggle } from "@workspace/core"

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
                href={USERS_PATH}
                className="font-heading text-sm font-bold uppercase italic"
              >
                Super Admin
              </a>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {/* ClerkLoaded gates the prebuilt UI component so it never
                    mounts before clerk-js loads its UI bundle (avoids the
                    "Clerk was not loaded with Ui components" crash). */}
                {isAuthed && (
                  <ClerkLoaded>
                    <UserButton />
                  </ClerkLoaded>
                )}
              </div>
            </header>
            <RoadmapApolloProvider>{children}</RoadmapApolloProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
