"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowUpDown,
  Layers3,
  Map,
  Users,
} from "lucide-react"
import {
  LEVEL_LABELS,
  type Roadmap,
  useFields,
  useRoadmap,
} from "@workspace/core"
import { cn } from "@workspace/ui/lib/utils"

import { AuthHeader } from "@/components/auth-header"

type SortMode = "popular" | "updated" | "nodes"

const SORT_LABELS: Record<SortMode, string> = {
  popular: "Phổ biến nhất",
  updated: "Mới cập nhật",
  nodes: "Ít node",
}

export function FieldRoadmaps({ slug }: { slug: string }) {
  const { fields, loading: fieldsLoading } = useFields()
  const { data: allRoadmaps, loading: roadmapsLoading } = useRoadmap()
  const [selectedId, setSelectedId] = useState<string>("all")
  const [sort, setSort] = useState<SortMode>("popular")

  const field = fields.find(
    (item) => item.slug === slug && item.publishStatus === "PUBLISHED"
  )
  const roadmaps = useMemo(
    () =>
      (allRoadmaps ?? []).filter(
        (roadmap) =>
          roadmap.publishStatus === "PUBLISHED" &&
          field &&
          roadmap.fields.some((item) => item.id === field.id)
      ),
    [allRoadmaps, field]
  )

  const visible = useMemo(() => {
    const filtered =
      selectedId === "all"
        ? roadmaps
        : roadmaps.filter((roadmap) => roadmap.id === selectedId)
    return [...filtered].sort((left, right) => {
      if (sort === "nodes") return left.nodeCount - right.nodeCount
      if (sort === "updated") {
        return (
          Date.parse(right.updatedAt ?? "1970-01-01") -
          Date.parse(left.updatedAt ?? "1970-01-01")
        )
      }
      return right.nodeCount - left.nodeCount
    })
  }, [roadmaps, selectedId, sort])

  if (fieldsLoading || roadmapsLoading) {
    return (
      <main className="min-h-screen bg-background" aria-busy="true">
        <div className="h-[420px] animate-pulse bg-muted" />
        <div className="mx-auto grid max-w-[1080px] gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[16/10] rounded-[14px] bg-muted" />
          ))}
        </div>
      </main>
    )
  }

  if (!field) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold">Không tìm thấy lĩnh vực</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lĩnh vực chưa được xuất bản hoặc đường dẫn không còn tồn tại.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center rounded-lg border border-foreground px-5 text-sm font-semibold"
          >
            Về tất cả lĩnh vực
          </Link>
        </div>
      </main>
    )
  }

  const nodeCount = roadmaps.reduce(
    (total, roadmap) => total + roadmap.nodeCount,
    0
  )
  const related = fields.filter(
    (item) => item.publishStatus === "PUBLISHED" && item.id !== field.id
  )

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section
        className="relative min-h-[420px] overflow-hidden bg-foreground text-white"
        style={
          field.imageUrl
            ? {
                backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.82),rgba(0,0,0,.5) 58%,rgba(0,0,0,.2)),url(${field.imageUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        <header className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="text-[22px] font-bold tracking-[-.5px] text-white"
          >
            lh222k
          </Link>
          <AuthHeader tone="on-dark" />
        </header>

        <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-10 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Tất cả lĩnh vực
          </Link>
          <h1 className="mt-5 max-w-3xl text-[42px] leading-[1.05] font-bold tracking-[-1px] text-balance sm:text-[54px]">
            {field.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/82 text-pretty">
            {field.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <HeroStat icon={Map} label={`${roadmaps.length} roadmap`} />
            <HeroStat icon={Layers3} label={`${nodeCount} node`} />
            <HeroStat icon={Users} label="Học theo tiến độ riêng" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip
              active={selectedId === "all"}
              onClick={() => setSelectedId("all")}
            >
              Tất cả <span aria-hidden>{roadmaps.length}</span>
            </FilterChip>
            {roadmaps.map((roadmap) => (
              <FilterChip
                key={roadmap.id}
                active={selectedId === roadmap.id}
                onClick={() => setSelectedId(roadmap.id)}
              >
                {roadmap.title} <span aria-hidden>1</span>
              </FilterChip>
            ))}
          </div>

          <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium">
            <ArrowUpDown className="size-4" />
            <span className="sr-only">Sắp xếp</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="bg-transparent pr-1 outline-none"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-x-5 gap-y-8 pt-7">
            {visible.map((roadmap) => (
              <FieldRoadmapCard
                key={roadmap.id}
                roadmap={roadmap}
                fallbackImage={field.imageUrl}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-[14px] border border-border p-8 text-center">
            <div>
              <p className="font-semibold">Không có roadmap ở bộ lọc này</p>
              <button
                type="button"
                onClick={() => setSelectedId("all")}
                className="mt-4 h-11 rounded-lg border border-foreground px-5 text-sm font-semibold"
              >
                Xem tất cả cấp độ
              </button>
            </div>
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section className="border-t border-border bg-secondary">
          <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-6">
            <h2 className="text-xl font-bold">Lĩnh vực liên quan</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/fields/${item.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold transition hover:border-foreground"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function HeroStat({
  icon: Icon,
  label,
}: {
  icon: typeof Map
  label: string
}) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/30 bg-black/28 px-3 text-sm font-medium text-white backdrop-blur-xl">
      <Icon className="size-4" />
      {label}
    </span>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background hover:border-foreground"
      )}
    >
      {children}
    </button>
  )
}

function FieldRoadmapCard({
  roadmap,
  fallbackImage,
}: {
  roadmap: Roadmap
  fallbackImage: string | null
}) {
  const image = roadmap.thumbnailUrl || fallbackImage
  const level = roadmap.level ? LEVEL_LABELS[roadmap.level] : null
  const typeLabel = roadmap.blockType === "skill" ? "Kỹ năng" : "Vai trò"

  return (
    <article className="group">
      <Link
        href={`/roadmaps/${roadmap.id}`}
        className="block rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="size-full object-cover transition duration-200 group-hover:scale-[1.025]"
            />
          ) : (
            <div className="grid size-full place-items-center text-sm font-medium text-muted-foreground">
              Chưa có ảnh bìa
            </div>
          )}
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              roadmap.visibility === "INTERNAL"
                ? "bg-foreground text-background"
                : "bg-background text-foreground"
            )}
          >
            {roadmap.visibility === "INTERNAL" ? "Nội bộ" : "Miễn phí"}
          </span>
          <div className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="rounded-lg bg-background px-4 py-2 text-sm font-semibold text-foreground">
              Mở roadmap
            </span>
          </div>
        </div>

        <div className="pt-3">
          <h2 className="text-base font-semibold tracking-[-.1px]">
            {roadmap.title}
          </h2>
          {roadmap.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {roadmap.description}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {roadmap.nodeCount} node · {typeLabel}
            {level ? ` · ${level}` : ""}
          </p>
          <p className="mt-1.5 text-sm font-medium">Chưa bắt đầu</p>
        </div>
      </Link>
    </article>
  )
}
