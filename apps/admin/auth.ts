import bcrypt from "bcryptjs"
import NextAuth, { type NextAuthResult } from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { prisma } from "@workspace/db"

// ponytail: JWT sessions + credentials only — no Prisma adapter needed until
// OAuth providers arrive. svc-notion decodes the same JWT with AUTH_SECRET.
const nextAuth = NextAuth({
  basePath: "/admin/api/auth", // Multi-Zones: app lives under /admin
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : ""
        const password =
          typeof credentials?.password === "string" ? credentials.password : ""
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.passwordHash) return null
        const valid = await bcrypt.compare(password, user.passwordHash)
        return valid ? { id: user.id, email: user.email, name: user.name } : null
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})

// explicit annotations: pnpm can't name NextAuth's inferred types (TS2742)
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers
export const auth: NextAuthResult["auth"] = nextAuth.auth
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut
