import { Button } from "@workspace/ui/components/button"

export const metadata = { title: "403 — Không có quyền truy cập" }

/**
 * Forbidden page (Req 1.2): viewers landing in the admin zone get told why
 * and a way back to the Web_App.
 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[calc(100svh-57px)] items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-5xl font-extrabold">403</h1>
        <p className="text-lg text-muted-foreground">
          Bạn không có quyền truy cập trang này
        </p>
        <Button
          nativeButton={false}
          render={<a href={process.env.NEXT_PUBLIC_HOST_URL || "/"} />}
        >
          Về trang chủ
        </Button>
      </div>
    </div>
  )
}
