import { ForbiddenScreen } from "@workspace/ui/components/forbidden-screen"

export const metadata = { title: "403 — Không có quyền truy cập" }

/** Rendered with a real 403 whenever a user-management page calls `forbidden()`. */
export default function Forbidden() {
  return (
    <ForbiddenScreen
      homeHref={process.env.NEXT_PUBLIC_HOST_URL || "/"}
      message="Chỉ Super-admin mới truy cập được khu vực này"
    />
  )
}
