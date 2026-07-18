import { Geist_Mono, Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import {
  devAuthRole,
  ReloadOnBackForward,
  RoadmapApolloProvider,
} from "@workspace/core"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { SiteHeader } from "@/components/site-header"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
          <SiteHeader />
          <RoadmapApolloProvider>{children}</RoadmapApolloProvider>
        </ThemeProvider>
      </body>
    </html>
  )

  // Dev bypass: skip <ClerkProvider> so the client never loads Clerk's external
  // hosted JS (blocked by the localhost-only preview / headless QA sandbox).
  const devBypass = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
  )
  // `dynamic`: render Clerk at request time. Without it the statically
  // prerendered /_not-found boundary calls auth() with no middleware context
  // → "can't detect clerkMiddleware()". Vercel runs preview as production, so
  // the dev bypass never applies there and this path always executes.
  return devBypass ? tree : <ClerkProvider dynamic>{tree}</ClerkProvider>
}
