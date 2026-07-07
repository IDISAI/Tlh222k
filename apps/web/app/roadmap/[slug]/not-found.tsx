export default function RoadmapNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-black uppercase">
        404 — Roadmap không tồn tại
      </h1>
      <p className="text-muted-foreground">
        Lộ trình bạn tìm không có trong hệ thống.
      </p>
      <a
        href="/roadmaps"
        className="rounded-md border-2 border-black bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        ← Về danh sách Roadmaps
      </a>
    </main>
  )
}
