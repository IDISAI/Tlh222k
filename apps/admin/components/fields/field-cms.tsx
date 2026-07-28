"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ChevronLeft, ChevronRight, ImageIcon, Layers3, Plus, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { RoadmapService, roadmapBackendEnabled, type CallerRole, type Field, type RoadmapNode } from "@workspace/core"

import { BASE_PATH } from "@/lib/paths"

const STATUS_LABEL = { DRAFT: "Đang soạn", PUBLISHED: "Đã xuất bản", PRIVATE: "Riêng tư" } as const
const STATUS_DOT = { DRAFT: "bg-amber-500", PUBLISHED: "bg-emerald-500", PRIVATE: "bg-slate-400" } as const

export function FieldCms({ role }: { role: CallerRole }) {
  const service = useMemo(() => new RoadmapService(), [])
  const [fields, setFields] = useState<Field[]>([])
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filter, setFilter] = useState<"ALL" | Field["publishStatus"]>("ALL")
  const [newestFirst, setNewestFirst] = useState(true)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    const [nextFields, nextNodes] = await Promise.all([service.listAdminFields(role), service.listNodes()])
    setFields(nextFields.sort((a, b) => a.order - b.order))
    setNodes(nextNodes.filter((node) => node.nodeType !== "article" && !node.isDeleted))
    setLoading(false)
  }
  useEffect(() => {
    if (!roadmapBackendEnabled()) {
      setError("CMS cần svc-api. Đặt NEXT_PUBLIC_SVC_API_URL trước khi dùng Field.")
      setLoading(false)
      return
    }
    void load().catch(() => {
      setError("Không thể tải danh sách lĩnh vực.")
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 220)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => { setPage(1) }, [debouncedQuery, filter, newestFirst])

  const counts = useMemo(() => ({
    ALL: fields.length,
    PUBLISHED: fields.filter((field) => field.publishStatus === "PUBLISHED").length,
    DRAFT: fields.filter((field) => field.publishStatus === "DRAFT").length,
    PRIVATE: fields.filter((field) => field.publishStatus === "PRIVATE").length,
  }), [fields])
  const filtered = fields.filter((field) => {
    const matchesStatus = filter === "ALL" || field.publishStatus === filter
    const normalized = debouncedQuery.trim().toLocaleLowerCase("vi")
    return matchesStatus && (!normalized || `${field.title} ${field.slug}`.toLocaleLowerCase("vi").includes(normalized))
  }).sort((a, b) => newestFirst ? b.order - a.order : a.order - b.order)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const membershipCount = (fieldId: string) => nodes.filter((node) => node.fields?.some((field) => field.id === fieldId)).length

  return <main className="min-h-full bg-[#fff] px-5 py-9 lg:px-8">
    <div className="mx-auto max-w-[1750px]">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-[27px] font-bold tracking-[-.04em]">Quản lý Lĩnh vực</h1><p className="mt-1 text-sm text-muted-foreground">Lĩnh vực là trang chủ Field Explorer — ảnh dùng cho thumbnail và nền toàn màn hình.</p></div><Link href={`${BASE_PATH}/fields/new`} className="inline-flex h-10 items-center rounded-lg bg-[#ff385c] px-4 font-semibold text-white hover:bg-[#e31c5f]"><Plus className="mr-1 size-4" />Tạo lĩnh vực</Link></div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Layers3 className="size-4" />} label="Tổng mục" value={counts.ALL} />
        <Metric icon={<span className="size-2 rounded-full bg-emerald-500" />} label="Đã xuất bản" value={counts.PUBLISHED} />
        <Metric icon={<span className="size-2 rounded-full bg-amber-500" />} label="Đang soạn" value={counts.DRAFT} />
        <Metric icon={<span className="size-2 rounded-full bg-slate-400" />} label="Riêng tư" value={counts.PRIVATE} />
      </section>

      <section className="mt-7 flex flex-wrap items-center justify-between gap-3"><label className="relative w-full max-w-[340px]"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc slug…" className="h-10 pl-9" /></label><div className="flex flex-wrap gap-2">{(["ALL", "PUBLISHED", "DRAFT", "PRIVATE"] as const).map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={cn("rounded-full border px-3 py-2 text-xs font-semibold", filter === status ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted")}>{status === "ALL" ? `Tất cả ${counts.ALL}` : `${STATUS_LABEL[status]} ${counts[status]}`}</button>)}</div><button type="button" onClick={() => setNewestFirst((value) => !value)} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold text-muted-foreground"><ArrowUpDown className="size-3.5" />{newestFirst ? "Cập nhật mới nhất" : "Thứ tự tăng dần"}</button></section>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <section className="mt-4 overflow-hidden rounded-xl border bg-card"><div className="grid grid-cols-[minmax(0,1fr)_130px_96px] items-center gap-5 border-b bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground lg:grid-cols-[minmax(0,1fr)_150px_130px_96px]"><span>Mô tả & roadmap</span><span>Trạng thái</span><span className="hidden lg:block">Thứ tự</span><span className="text-right">Hành động</span></div>{loading ? <div className="px-5 py-14 text-center text-sm text-muted-foreground">Đang tải lĩnh vực…</div> : pageRows.map((field) => <FieldRow key={field.id} field={field} roadmapCount={membershipCount(field.id)} />)}{!loading && filtered.length === 0 && <div className="px-5 py-14 text-center text-sm text-muted-foreground"><p>Không tìm thấy lĩnh vực phù hợp.</p>{(query || filter !== "ALL") && <button type="button" onClick={() => { setQuery(""); setFilter("ALL") }} className="mt-3 font-semibold text-[#e31c5f] hover:underline">Xóa bộ lọc</button>}</div>}</section>
      <div className="mt-3 flex items-center justify-between px-1 text-sm text-muted-foreground"><span>Hiển thị {pageRows.length} / {filtered.length} mục</span><span className="flex gap-1"><button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Trang sau" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="grid size-8 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button></span></div>
    </div>

  </main>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><div className="mt-2 text-2xl font-bold tracking-tight">{value}</div></div>
}

function FieldRow({ field, roadmapCount }: { field: Field; roadmapCount: number }) {
  return <Link href={`${BASE_PATH}/fields/${field.id}`} className="grid grid-cols-[minmax(0,1fr)_130px_96px] items-center gap-5 border-b px-4 py-3.5 last:border-0 hover:bg-[#fafafa] lg:grid-cols-[minmax(0,1fr)_150px_130px_96px]"><span className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground" style={field.imageUrl ? { backgroundImage: `url(${field.imageUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{!field.imageUrl && <ImageIcon className="size-4" />}</span><span className="min-w-0"><span className="block truncate font-semibold">{field.title}</span><span className="block truncate text-xs text-muted-foreground">{field.description || `/${field.slug}`} <span className="mx-1 text-border">·</span>{roadmapCount} roadmap</span></span></span><span><span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"><i className={cn("size-1.5 rounded-full", STATUS_DOT[field.publishStatus])} />{STATUS_LABEL[field.publishStatus]}</span></span><span className="hidden text-sm text-muted-foreground lg:block">#{field.order + 1}</span><span className="text-right text-sm font-medium text-muted-foreground">Mở →</span></Link>
}
