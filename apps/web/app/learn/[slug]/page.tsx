import { BookOpen } from "lucide-react"

import { loadExerciseNotebook, loadTutorialNotebook } from "@/lib/notebook"
import { LearnClient } from "./learn-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const notebook = await loadTutorialNotebook(slug)
  return { title: notebook?.title ?? "Learn" }
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [tutorial, exercise] = await Promise.all([
    loadTutorialNotebook(slug),
    loadExerciseNotebook(slug),
  ])

  // No fixture for this slug yet. Instead of a bare 404, explain the notebook
  // isn't published — an internal jupyter node whose content hasn't been
  // authored (or synced from the admin editor via the Go kernel-server) lands
  // here. External jupyter nodes (Colab URL) never reach /learn.
  if (!tutorial) return <NotebookNotReady slug={slug} />

  return <LearnClient tutorial={tutorial} exercise={exercise} />
}

function NotebookNotReady({ slug }: { slug: string }) {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <BookOpen className="size-9 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Notebook chưa sẵn sàng</h1>
      <p className="text-sm text-muted-foreground">
        Notebook{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">{slug}</code> chưa có
        nội dung được xuất bản. Nội dung sẽ xuất hiện khi được tạo trong trình
        soạn thảo (admin) và đồng bộ.
      </p>
      <a
        href="/roadmaps"
        className="text-sm font-medium text-primary underline underline-offset-2"
      >
        ← Quay lại danh sách roadmap
      </a>
    </div>
  )
}
