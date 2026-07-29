"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import {
  ArrowUpDown,
  BookOpen,
  Clock3,
  ExternalLink,
  Globe,
  ImageIcon,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"

import {
  FallbackNotebookStore,
  HttpNotebookStore,
  RoadmapService,
  type NotebookSummary,
  type RoadmapNode,
} from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"
import { slugify } from "@workspace/core/notebook/utils/slugify"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

const KERNEL_SERVER_URL = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL
const PUBLIC_WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"

export function NotebooksIndexClient() {
  const isDev = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  ) !== null
  return isDev ? <NotebooksIndex getToken={async () => "dev-token"} /> : <ClerkNotebooksIndex />
}

function ClerkNotebooksIndex() {
  const { getToken } = useAuth()
  return <NotebooksIndex getToken={getToken} />
}

function NotebooksIndex({ getToken }: { getToken: () => Promise<string | null> }) {
  const router = useRouter()
  const store = useMemo(() => {
    const apiBase = typeof window !== "undefined" && window.location.pathname.startsWith("/admin") ? "/admin" : ""
    const fallback = new HttpNotebookStore(apiBase, getToken)
    return KERNEL_SERVER_URL
      ? new FallbackNotebookStore(new HttpNotebookStore(KERNEL_SERVER_URL, getToken, 5_000), fallback)
      : fallback
  }, [getToken])
  const [notebooks, setNotebooks] = useState<NotebookSummary[] | null>(null)
  const [title, setTitle] = useState("")
  const [chapterId, setChapterId] = useState("")
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all")
  const [newestFirst, setNewestFirst] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chapters, setChapters] = useState<RoadmapNode[]>([])

  const refresh = useCallback(() => {
    void store.list().then(setNotebooks).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Không tải được danh sách"))
  }, [store])
  useEffect(refresh, [refresh])

  // Every notebook must be filed under a chapter so an admin can always tell
  // which roadmap it belongs to — loaded once, reused across every open of
  // the create dialog.
  const roadmap = useMemo(() => new RoadmapService(), [])
  useEffect(() => {
    void roadmap
      .listNodes()
      .then((nodes) =>
        setChapters(nodes.filter((n) => n.nodeType === "chapter" && !n.isDeleted))
      )
      .catch(() => setChapters([]))
  }, [roadmap])

  const slug = slugify(title)
  const published = (notebooks ?? []).filter((item) => item.published).length
  const drafts = (notebooks ?? []).filter((item) => !item.published).length
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi")
    return (notebooks ?? []).filter((item) => {
      const matchesQuery = !needle || `${item.title} ${item.slug}`.toLocaleLowerCase("vi").includes(needle)
      const matchesFilter = filter === "all" || (filter === "published" ? item.published : !item.published)
      return matchesQuery && matchesFilter
    }).sort((a, b) => (newestFirst ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()))
  }, [filter, newestFirst, notebooks, query])
  const createNotebook = async () => {
    if (!slug || !chapterId) return
    setCreating(true)
    setError(null)
    try {
      // The article Node is the thing that records "this notebook belongs to
      // this chapter" — created first so the notebook is never without one.
      // Its own slugify may collide/adjust the title, so the notebook is
      // filed under whatever slug the Node actually got, not the raw title.
      const node = await roadmap.createArticle(
        { chapterId, title: title.trim(), articleType: "jupyter" },
        "admin"
      )
      router.push(`/notebooks/${node.slug}?title=${encodeURIComponent(title.trim())}`)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tạo notebook"
      )
      setCreating(false)
    }
  }

  return <main className="mx-auto w-full max-w-[1480px] space-y-6 p-6 lg:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight">Quản lý Notebook</h1><p className="mt-1 text-muted-foreground">Notebook tương tác chạy trên kernel Pyodide hoặc kernel được cấu hình.</p></div>
      <Button className="h-11 bg-[#ff385c] px-5 text-base hover:bg-[#e31c5f]" onClick={() => setCreateOpen(true)}><Plus className="size-5" />Tạo notebook</Button>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan notebook">
      <Metric icon={<BookOpen className="size-4" />} label="Tổng mục" value={notebooks?.length ?? "…"} />
      <Metric icon={<Globe className="size-4" />} label="Đã xuất bản" value={published} tone="text-emerald-600" />
      <Metric icon={<Clock3 className="size-4" />} label="Đang soạn" value={drafts} tone="text-amber-600" />
      <Metric icon={<Users className="size-4" />} label="Người học đang theo" value="12.4k" />
    </section>
    <div className="flex flex-col justify-between gap-3 lg:flex-row">
      <div className="flex flex-wrap gap-2"><div className="relative w-full sm:w-[310px]"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Tìm theo tên hoặc slug..." /></div>
        <Filter active={filter === "all"} onClick={() => setFilter("all")}>Tất cả {notebooks?.length ?? 0}</Filter><Filter active={filter === "published"} onClick={() => setFilter("published")}>Đã xuất bản {published}</Filter><Filter active={filter === "draft"} onClick={() => setFilter("draft")}>Đang soạn {drafts}</Filter></div>
      <Button type="button" variant="outline" onClick={() => setNewestFirst((value) => !value)}><ArrowUpDown className="size-4" />{newestFirst ? "Cập nhật mới nhất" : "Cập nhật cũ nhất"}</Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <section className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[minmax(280px,1fr)_180px_160px_150px_120px] gap-4 border-b bg-muted/35 px-5 py-3 text-sm font-medium text-muted-foreground lg:grid"><span>Tiêu đề</span><span>Trạng thái</span><span>Tác giả</span><span>Cập nhật</span><span className="text-right">Hành động</span></div>
      {notebooks === null ? <p className="p-8 text-sm text-muted-foreground">Đang tải notebook…</p> : visible.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">Chưa có notebook phù hợp.</p> : <ul className="divide-y">{visible.map((item) => <li key={item.slug} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(280px,1fr)_180px_160px_150px_120px] lg:items-center"><Link href={`/notebooks/${item.slug}`} className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed bg-muted/60 text-muted-foreground"><ImageIcon className="size-4" /></span><span className="min-w-0"><p className="truncate font-semibold hover:underline">{item.title || item.slug}</p><p className="mt-0.5 truncate text-sm text-muted-foreground">/{item.slug} · Notebook</p></span></Link><Status published={item.published} /><span className="inline-flex items-center gap-2 text-sm"><span className="grid size-7 place-items-center rounded-full bg-violet-600 text-[10px] font-bold text-white">AD</span>Admin</span><time className="text-sm text-muted-foreground">{formatUpdated(item.updatedAt)}</time><div className="flex justify-end gap-1"><Link href={`/notebooks/${item.slug}`} aria-label={`Sửa ${item.slug}`} className="grid size-8 place-items-center rounded-md hover:bg-muted"><PencilLine className="size-4" /></Link><a href={`${PUBLIC_WEB_ORIGIN}/notebooks/${item.slug}`} target="_blank" rel="noreferrer" aria-label={`Xem trước ${item.slug}`} className="grid size-8 place-items-center rounded-md hover:bg-muted"><ExternalLink className="size-4" /></a><button type="button" aria-label={`Xóa ${item.slug}`} className="grid size-8 place-items-center rounded-md text-destructive hover:bg-destructive/10" onClick={() => { if (confirm(`Xóa notebook “${item.title || item.slug}”?`)) void store.remove(item.slug).then(refresh).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Xóa thất bại")) }}><Trash2 className="size-4" /></button></div></li>)}</ul>}
    </section>
    <p className="text-sm text-muted-foreground">Hiển thị {visible.length} / {notebooks?.length ?? 0} mục</p>
    {createOpen && <div role="dialog" aria-modal="true" aria-labelledby="create-notebook-title" className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="create-notebook-title" className="text-xl font-bold">Tạo notebook mới</h2><p className="mt-1 text-sm text-muted-foreground">Đặt tên rồi mở trình soạn để tạo bản nháp đầu tiên.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Đóng"><X className="size-5" /></button></div><label className="mt-6 block text-sm font-semibold">Tên notebook<Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createNotebook() }} className="mt-2 h-11" placeholder="VD: Intro to NumPy" /></label>{slug && <p className="mt-2 text-xs text-muted-foreground">Đường dẫn: /notebooks/{slug}</p>}<label className="mt-4 block text-sm font-semibold">Thuộc chapter<span className="ml-1 text-xs font-normal text-destructive">Bắt buộc</span><select value={chapterId} onChange={(event) => setChapterId(event.target.value)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">{chapters.length === 0 ? "Chưa có chapter nào" : "Chọn chapter…"}</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Để admin biết notebook này thuộc roadmap nào.</span></label><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button disabled={!slug || !chapterId || creating} className="bg-[#ff385c] hover:bg-[#e31c5f]" onClick={() => void createNotebook()}>{creating ? "Đang tạo…" : "Mở trình soạn"}</Button></div></section></div>}
  </main>
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string | number; tone?: string }) { return <div className="rounded-xl border bg-card p-5"><p className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</p><p className={cn("mt-2 text-2xl font-bold tracking-tight", tone)}>{value}</p></div> }
function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={cn("h-10 rounded-full border px-3 text-sm font-semibold", active ? "border-[#222] bg-[#222] text-white" : "bg-background text-muted-foreground hover:bg-muted")}>{children}</button> }
function Status({ published }: { published: boolean }) { return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", published ? "border-emerald-600/20 text-emerald-700" : "border-amber-500/30 text-amber-700")}><span className={cn("size-1.5 rounded-full", published ? "bg-emerald-500" : "bg-amber-500")} />{published ? "Đã xuất bản" : "Đang soạn"}</span> }
function formatUpdated(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN") }
