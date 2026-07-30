import { Button } from "./button"

/**
 * The refusal screen both CMS zones render for `forbidden()`. It lives here
 * rather than in either app because a Viewer who guesses an admin URL and a
 * Viewer who guesses a super-admin one are owed the same answer, and two
 * copies drift.
 */
export function ForbiddenScreen({
  homeHref = "/",
  message = "Bạn không có quyền truy cập trang này",
}: {
  homeHref?: string
  message?: string
}) {
  return (
    <div className="flex min-h-[calc(100svh-57px)] items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-5xl font-extrabold">403</h1>
        <p className="text-lg text-muted-foreground">{message}</p>
        <Button nativeButton={false} render={<a href={homeHref} />}>
          Về trang chủ
        </Button>
      </div>
    </div>
  )
}
