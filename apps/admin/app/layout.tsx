import { Geist_Mono, Inter } from "next/font/google"

import { PlatformSwitch } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import "@workspace/ui/globals.css"

import { auth } from "@/auth"
import { ModeToggle } from "@/components/mode-toggle"
import { ThemeProvider } from "@/components/theme-provider"
import { logoutAction } from "@/lib/auth-actions"

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
  const session = await auth()
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <header className="flex items-center gap-2 border-b p-3">
            <PlatformSwitch current="admin" />
            <div className="ml-auto flex items-center gap-2">
              <ModeToggle />
              {session?.user && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {session.user.name ?? session.user.email}
                  </span>
                  <form action={logoutAction}>
                    <Button variant="ghost" size="sm" type="submit">
                      Đăng xuất
                    </Button>
                  </form>
                </>
              )}
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
