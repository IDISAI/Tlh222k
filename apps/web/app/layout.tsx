import Link from "next/link"
import { Geist_Mono, Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import {
  devAuthRole,
  ReloadOnBackForward,
  RoadmapApolloProvider,
  ThemeToggle,
} from "@workspace/core"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { AuthHeader } from "@/components/auth-header"

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  var s = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (t === 'dark' || (!t && s)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body>
        <ReloadOnBackForward />
        <ThemeProvider>
          <header className="flex items-center justify-between border-b p-3">
            <Link
              href="/"
              className="font-heading text-sm font-bold uppercase italic"
            >
              Roadmap
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <AuthHeader />
            </div>
          </header>
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
  return devBypass ? tree : <ClerkProvider>{tree}</ClerkProvider>
}
