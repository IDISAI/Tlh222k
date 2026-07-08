import Link from "next/link"
import { Geist_Mono, Inter } from "next/font/google"
import { ClerkProvider, UserButton } from "@clerk/nextjs"

import { RoadmapApolloProvider, ThemeToggle } from "@workspace/core"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { getIsAuthenticated } from "@/lib/auth"

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
              <Link
                href="/"
                className="font-heading text-sm font-bold uppercase italic"
              >
                Super Admin
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {isAuthed && <UserButton />}
              </div>
            </header>
            <RoadmapApolloProvider>{children}</RoadmapApolloProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
