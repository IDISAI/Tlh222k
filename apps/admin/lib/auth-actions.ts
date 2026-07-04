"use server"

import { redirect } from "next/navigation"

import bcrypt from "bcryptjs"
import { AuthError } from "next-auth"

import { prisma } from "@workspace/db"

import { signIn, signOut } from "@/auth"

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin", // Auth.js redirects are origin-relative — include basePath
    })
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=invalid")
    throw error // NEXT_REDIRECT on success must propagate
  }
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  const name = String(formData.get("name") ?? "").trim() || null

  if (!/.+@.+\..+/.test(email)) redirect("/register?error=email")
  if (password.length < 8) redirect("/register?error=password")

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) redirect("/register?error=exists")

  await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10) },
  })

  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" })
  } catch (error) {
    if (error instanceof AuthError) redirect("/login")
    throw error
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" })
}
