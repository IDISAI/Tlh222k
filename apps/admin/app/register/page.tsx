import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { registerAction } from "@/lib/auth-actions"

const ERRORS: Record<string, string> = {
  email: "Email không hợp lệ.",
  password: "Mật khẩu tối thiểu 8 ký tự.",
  exists: "Email này đã có tài khoản — hãy đăng nhập.",
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Đăng ký</CardTitle>
          <CardDescription>Tạo tài khoản để bắt đầu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Tên</Label>
              <Input id="name" name="name" autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mật khẩu (≥ 8 ký tự)</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            {error && (
              <p className="text-sm text-destructive">
                {ERRORS[error] ?? "Không hợp lệ."}
              </p>
            )}
            <Button type="submit">Tạo tài khoản</Button>
            <p className="text-center text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <Link className="underline" href="/login">
                Đăng nhập
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
