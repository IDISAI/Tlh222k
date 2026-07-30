"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpDown, BookOpen, Clock3, ExternalLink, FileText, Globe, ImageIcon, PencilLine, Plus, Search, Trash2, Users, X } from "lucide-react"

import { RoadmapService, type NotionDoc, type RoadmapNode } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { RequiredMark } from "@workspace/ui/components/required-mark"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "@workspace/ui/components/sonner"

import { archive, createDocumentForNode, getSearch } from "./actions"

const PUBLIC_WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"

export function NotionCmsClient() {
  const router = useRouter()
  const [documents, setDocuments] = useState<NotionDoc[] | null>(null)
  const [query, setQuery] = useState("")
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all")
  const [newestFirst, setNewestFirst] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [chapterId, setChapterId] = useState("")
  const [chapters, setChapters] = useState<RoadmapNode[]>([])

  // Every document must be filed under a chapter so an admin can always tell
  // which roadmap it belongs to.
  const roadmap = useMemo(() => new RoadmapService(), [])
  useEffect(() => {
    void roadmap
      .listNodes()
      .then((nodes) =>
        setChapters(nodes.filter((n) => n.nodeType === "chapter" && !n.isDeleted))
      )
      .catch(() => setChapters([]))
  }, [roadmap])

  const refresh = useCallback(async () => {
    try {
      setDocuments(await getSearch())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được tài liệu")
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Only root documents own a stable slug and can be opened as a workspace.
  // Child pages are managed from their root document sidebar.
  const rootDocuments = useMemo(
    () => (documents ?? []).filter((document) => document.slug !== null),
    [documents]
  )

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    return rootDocuments.filter((document) => {
      const matchesQuery = !normalized || `${document.title} ${document.slug ?? ""}`.toLocaleLowerCase("vi").includes(normalized)
      const matchesFilter = filter === "all" || (filter === "published" ? document.isPublished : !document.isPublished)
      return matchesQuery && matchesFilter
    }).sort((a, b) => (newestFirst ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()))
  }, [filter, newestFirst, rootDocuments, query])

  const published = rootDocuments.filter((document) => document.isPublished).length
  const drafts = rootDocuments.filter((document) => !document.isPublished).length

  const createDocument = async () => {
    if (!title.trim() || !chapterId) return
    setBusy(true)
    try {
      // The article Node records "this document belongs to this chapter" —
      // created first, then the Document is filed under the Node's own slug
      // (join key), mirroring the roadmap-canvas notion-article-node flow.
      const chapter = chapters.find((c) => c.id === chapterId)
      const node = await roadmap.createArticle(
        { chapterId, title: title.trim(), articleType: "notion" },
        "admin"
      )
      const doc = await createDocumentForNode(node.slug, node.title, chapter?.slug ?? undefined)
      if (!doc) {
        toast.warning("Bài viết đã được tạo nhưng chưa tạo được trang Notion liên kết.")
        return
      }
      await roadmap.updateNode(node.id, { notionPageId: doc.id }, "admin")
      toast.success("Đã tạo tài liệu nháp")
      router.push(`/notion/${node.slug}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tạo tài liệu thất bại")
    } finally {
      setBusy(false)
    }
  }

  const archiveDocument = async (document: NotionDoc) => {
    if (!confirm(`Lưu trữ tài liệu “${document.title}”?`)) return
    try {
      await archive(document.id)
      toast.success("Đã lưu trữ tài liệu")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lưu trữ thất bại")
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1480px] space-y-6 p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tài liệu Notion</h1>
          <p className="mt-1 text-muted-foreground">
            Soạn, xuất bản và quản lý tài liệu dùng trong lộ trình học.
          </p>
        </div>
        <Button className="h-11 bg-[#ff385c] px-5 text-base hover:bg-[#e31c5f]" onClick={() => setCreateOpen(true)}><Plus className="size-5" /> Tạo tài liệu</Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan tài liệu">
        <Metric icon={<BookOpen className="size-4" />} label="Tổng mục" value={documents === null ? "…" : rootDocuments.length} />
        <Metric icon={<Globe className="size-4" />} label="Đã xuất bản" value={published} tone="text-emerald-600" />
        <Metric icon={<Clock3 className="size-4" />} label="Đang soạn" value={drafts} tone="text-amber-600" />
        <Metric icon={<Users className="size-4" />} label="Người học đang theo" value="12.4k" />
      </section>

      <div className="flex flex-col justify-between gap-3 lg:flex-row"><div className="flex flex-wrap gap-2"><div className="relative w-full sm:w-[310px]"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Tìm theo tên hoặc slug..." aria-label="Tìm tài liệu" /></div><Filter active={filter === "all"} onClick={() => setFilter("all")}>Tất cả {rootDocuments.length}</Filter><Filter active={filter === "published"} onClick={() => setFilter("published")}>Đã xuất bản {published}</Filter><Filter active={filter === "draft"} onClick={() => setFilter("draft")}>Đang soạn {drafts}</Filter></div><Button type="button" variant="outline" onClick={() => setNewestFirst((value) => !value)}><ArrowUpDown className="size-4" />{newestFirst ? "Cập nhật mới nhất" : "Cập nhật cũ nhất"}</Button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[minmax(280px,1fr)_180px_160px_150px_120px] gap-4 border-b bg-muted/35 px-5 py-3 text-sm font-medium text-muted-foreground lg:grid"><span>Tiêu đề</span><span>Trạng thái</span><span>Tác giả</span><span>Cập nhật</span><span className="text-right">Hành động</span></div>
        {documents === null ? (
          <p className="p-8 text-sm text-muted-foreground">Đang tải tài liệu…</p>
        ) : visibleDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto mb-3 size-9 text-muted-foreground" />
            <p className="font-medium">Chưa có tài liệu phù hợp</p>
            <p className="mt-1 text-sm text-muted-foreground">Tạo tài liệu nháp đầu tiên để bắt đầu biên soạn.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {visibleDocuments.map((document) => {
              const slug = document.slug ?? document.id
              return (
                <li key={document.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(280px,1fr)_180px_160px_150px_120px] lg:items-center">
                  <Link href={`/notion/${slug}`} className="flex min-w-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed bg-muted/60 text-muted-foreground"><ImageIcon className="size-4" /></span><span className="min-w-0"><p className="truncate font-semibold hover:underline">{document.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {document.slug ? `/${document.slug} · ` : ""}Cập nhật {new Date(document.updatedAt).toLocaleString("vi-VN")}
                    </p></span>
                  </Link>
                  <Status published={document.isPublished} /><span className="inline-flex items-center gap-2 text-sm"><span className="grid size-7 place-items-center rounded-full bg-rose-700 text-[10px] font-bold text-white">AD</span>Admin</span><time className="text-sm text-muted-foreground">{new Date(document.updatedAt).toLocaleDateString("vi-VN")}</time><div className="flex justify-end gap-1"><Link href={`/notion/${slug}`} aria-label={`Sửa ${document.title}`} className="grid size-8 place-items-center rounded-md hover:bg-muted"><PencilLine className="size-4" /></Link><a href={`${PUBLIC_WEB_ORIGIN}/notion/${slug}`} target="_blank" rel="noreferrer" aria-label={`Xem trước ${document.title}`} className="grid size-8 place-items-center rounded-md hover:bg-muted"><ExternalLink className="size-4" /></a><button type="button" aria-label={`Lưu trữ ${document.title}`} className="grid size-8 place-items-center rounded-md text-destructive hover:bg-destructive/10" onClick={() => void archiveDocument(document)}><Trash2 className="size-4" /></button></div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <p className="text-sm text-muted-foreground">Hiển thị {visibleDocuments.length} / {rootDocuments.length} mục</p>
      {createOpen && <div role="dialog" aria-modal="true" aria-labelledby="create-document-title" className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="create-document-title" className="text-xl font-bold">Tạo tài liệu mới</h2><p className="mt-1 text-sm text-muted-foreground">Bản nháp được lưu tự động khi bạn bắt đầu soạn.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Đóng"><X className="size-5" /></button></div><label className="mt-6 block text-sm font-semibold">Tên tài liệu<RequiredMark /><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createDocument() }} className="mt-2 h-11" placeholder="VD: Learning Resources" aria-required="true" /></label><label className="mt-4 block text-sm font-semibold">Thuộc chapter<RequiredMark /><select value={chapterId} onChange={(event) => setChapterId(event.target.value)} aria-required="true" className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">{chapters.length === 0 ? "Chưa có chapter nào" : "Chọn chapter…"}</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Để admin biết tài liệu này thuộc roadmap nào.</span></label><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button disabled={busy || !title.trim() || !chapterId} className="bg-[#ff385c] hover:bg-[#e31c5f]" onClick={() => void createDocument()}>{busy ? "Đang tạo…" : "Tạo bản nháp"}</Button></div></section></div>}
    </main>
  )
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</p>
      <p className={cn("mt-2 text-2xl font-bold tracking-tight", tone)}>{value}</p>
    </div>
  )
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={cn("h-10 rounded-full border px-3 text-sm font-semibold", active ? "border-[#222] bg-[#222] text-white" : "bg-background text-muted-foreground hover:bg-muted")}>{children}</button> }
function Status({ published }: { published: boolean }) { return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", published ? "border-emerald-600/20 text-emerald-700" : "border-amber-500/30 text-amber-700")}><span className={cn("size-1.5 rounded-full", published ? "bg-emerald-500" : "bg-amber-500")} />{published ? "Đã xuất bản" : "Đang soạn"}</span> }
