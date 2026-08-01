"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
// Aliased: an icon named `Map` shadows the built-in used for the tag counts.
import {
  ArrowLeft,
  ArrowUpDown,
  Layers3,
  Map as MapIcon,
  Users,
} from "lucide-react"
import {
  entitlementLabel,
  LEVEL_LABELS,
  normalizeRoadmapVisibility,
  type Roadmap,
  useFields,
  useRoadmap,
} from "@workspace/core"
import { cn } from "@workspace/ui/lib/utils"

import { AuthHeader } from "@/components/auth-header"

/**
 * The three orders the access contract names. "popular" is unique learners who
 * started content — not node count, not page views — so a big empty roadmap
 * cannot outrank a small one people actually work through.
 */
type SortMode = "popular" | "newest" | "az"

const SORT_LABELS: Record<SortMode, string> = {
  popular: "Phổ biến nhất",
  // Deliberately not "Mới xuất bản": a block carries no first-publish
  // timestamp yet, so this orders by creation time and the label says so.
  newest: "Mới nhất",
  az: "A–Z",
}

const ALL_TAGS = "all"

export function FieldRoadmaps({ slug }: { slug: string }) {
  const { fields, loading: fieldsLoading } = useFields()
  const { data: allRoadmaps, loading: roadmapsLoading } = useRoadmap()
  const [tag, setTag] = useState<string>(ALL_TAGS)
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

  // Chips come from the roadmaps' own role tags. A tag nobody carries never
  // appears, so every chip leads somewhere and its count is the real number of
  // roadmaps behind it.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const roadmap of roadmaps) {
      for (const roleTag of roadmap.roleTags ?? []) {
        counts.set(roleTag, (counts.get(roleTag) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((left, right) =>
      left[0].localeCompare(right[0], "vi")
    )
  }, [roadmaps])

  const visible = useMemo(() => {
    const filtered =
      tag === ALL_TAGS
        ? roadmaps
        : roadmaps.filter((roadmap) => (roadmap.roleTags ?? []).includes(tag))
    return [...filtered].sort((left, right) => {
      if (sort === "az") return left.title.localeCompare(right.title, "vi")
      if (sort === "newest") {
        // Prefer a real publish time where one exists; blocks only have a
        // creation time, and an unparseable value sorts last rather than to
        // the epoch, which would put unknowns at the top under a reversal.
        const at = (roadmap: Roadmap) =>
          Date.parse(roadmap.firstPublishedAt ?? roadmap.createdAt ?? "") || 0
        return at(right) - at(left)
      }
      return (right.learnerCount ?? 0) - (left.learnerCount ?? 0)
    })
  }, [roadmaps, tag, sort])

  if (fieldsLoading || roadmapsLoading) {
    return (
      <main className="min-h-screen bg-background" aria-busy="true">
        <div className="h-[420px] animate-pulse bg-muted" />
        <div className="mx-auto grid max-w-[1080px] gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[16/10] rounded-[14px] bg-muted"
            />
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
  // Per the contract a Field's learner count is people who started one of its
  // roadmaps. Summing per-roadmap counts double-counts anyone working through
  // two, so this is an upper bound — show it only when it is not a guess, i.e.
  // when at least one roadmap actually reports a figure.
  const learnerTotal = roadmaps.reduce(
    (total, roadmap) => total + (roadmap.learnerCount ?? 0),
    0
  )
  const related = fields.filter(
    (item) => item.publishStatus === "PUBLISHED" && item.id !== field.id
  )

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section
        className="relative isolate min-h-[460px] overflow-hidden bg-[#0b1020] text-white"
        style={{
          backgroundImage: field.imageUrl
            ? `linear-gradient(102deg,rgba(5,8,18,.94) 0%,rgba(5,8,18,.68) 48%,rgba(5,8,18,.88) 100%),url(${field.imageUrl})`
            : "radial-gradient(circle at 74% 18%, rgba(255,56,92,.28), transparent 30%), radial-gradient(circle at 18% 95%, rgba(91,86,255,.24), transparent 36%), linear-gradient(135deg,#11182e,#070a12 66%)",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:38px_38px] opacity-35" />
        <header className="relative mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="rounded-md text-[22px] font-bold tracking-[-.5px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1020]"
          >
            Tlh222k
          </Link>
          <AuthHeader tone="on-dark" />
        </header>

        <div className="relative mx-auto max-w-[1280px] px-4 pt-12 pb-16 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-white/90 transition outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="size-4" />
            Tất cả lĩnh vực
          </Link>
          <h1 className="mt-5 max-w-3xl text-[42px] leading-[1.02] font-bold tracking-[-1.4px] text-balance sm:text-6xl">
            {field.title}
          </h1>
          {field.description && (
            <p className="mt-5 line-clamp-4 max-w-[610px] text-[17px] leading-[1.65] text-pretty [overflow-wrap:anywhere] text-white/86">
              {field.description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <HeroStat icon={MapIcon} label={`${roadmaps.length} roadmap`} />
            <HeroStat icon={Layers3} label={`${nodeCount} node`} />
            {learnerTotal > 0 && (
              <HeroStat icon={Users} label={`${learnerTotal} học viên`} />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip
              active={tag === ALL_TAGS}
              count={roadmaps.length}
              onClick={() => setTag(ALL_TAGS)}
            >
              Tất cả
            </FilterChip>
            {tagCounts.map(([roleTag, count]) => (
              <FilterChip
                key={roleTag}
                active={tag === roleTag}
                count={count}
                onClick={() => setTag(roleTag)}
              >
                {roleTag}
              </FilterChip>
            ))}
          </div>

          <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-[13px] font-semibold shadow-sm">
            <ArrowUpDown className="size-[15px]" />
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-5 pt-7 sm:gap-6">
            {visible.map((roadmap) => (
              <FieldRoadmapCard
                key={roadmap.id}
                roadmap={roadmap}
                fallbackImage={field.imageUrl}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid min-h-56 place-items-center rounded-[14px] border border-dashed border-border p-14 text-center">
            <div>
              <p className="text-muted-foreground">
                Không có roadmap nào ở bộ lọc này.
              </p>
              <button
                type="button"
                onClick={() => setTag(ALL_TAGS)}
                className="mt-3.5 h-11 rounded-lg border border-foreground px-4.5 text-sm font-semibold"
              >
                Xem tất cả
              </button>
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-12 border-t border-border pt-7">
            <h2 className="text-xl font-bold">Lĩnh vực liên quan</h2>
            <div className="mt-4 flex flex-wrap gap-3.5">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/fields/${item.slug}`}
                  className="flex items-center gap-3 rounded-full border border-border py-2.5 pr-4 pl-2.5 transition hover:bg-secondary"
                >
                  <span className="h-[34px] w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </span>
                  <span className="text-sm font-semibold">{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function HeroStat({
  icon: Icon,
  label,
}: {
  icon: typeof MapIcon
  label: string
}) {
  return (
    <span className="inline-flex min-h-9 items-center gap-[7px] rounded-full border border-white/30 bg-black/28 px-3.5 text-sm font-medium text-white backdrop-blur-xl">
      <Icon className="size-[15px]" />
      {label}
    </span>
  )
}

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-[7px] rounded-full border px-4 text-[13px] font-semibold transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground"
      )}
    >
      {children}
      <span className={active ? "text-background/65" : "text-muted-foreground"}>
        {count}
      </span>
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
  // Normalize once. Reading the raw value for the style while the label goes
  // through the normalizer lets a stray "internal" print the AIO wording on
  // the free-coloured pill.
  const isInternal =
    normalizeRoadmapVisibility(roadmap.visibility) === "INTERNAL"
  const learners = roadmap.learnerCount ?? 0

  return (
    <article className="group h-full">
      <Link
        href={`/roadmaps/${roadmap.id}`}
        className="block h-full rounded-2xl transition duration-200 outline-none hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-sm transition duration-200 group-hover:shadow-xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="size-full object-cover transition duration-200 group-hover:scale-[1.025]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_78%_16%,hsl(var(--foreground)/.12),transparent_32%),linear-gradient(145deg,hsl(var(--muted)),hsl(var(--background)))] p-6 text-center text-sm font-medium text-muted-foreground">
              Chưa có ảnh bìa
            </div>
          )}
          <span
            className={cn(
              "absolute top-3 left-3 rounded-full border border-black/5 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur",
              isInternal
                ? "bg-foreground text-background"
                : "bg-background text-foreground"
            )}
          >
            {entitlementLabel(roadmap.visibility)}
          </span>
          <div className="absolute inset-0 grid place-items-center bg-black/42 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
            <span className="rounded-full bg-background px-4 py-2 text-[13px] font-semibold text-foreground shadow-float">
              Mở roadmap
            </span>
          </div>
        </div>

        <div className="px-1 pt-3">
          <h2 className="text-[17px] font-semibold tracking-[-.2px] group-hover:underline">
            {roadmap.title}
          </h2>
          {roadmap.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {roadmap.description}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{roadmap.nodeCount} node</span>
            {level && (
              <>
                <span aria-hidden>·</span>
                <span>{level}</span>
              </>
            )}
            {learners > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{learners} học viên</span>
              </>
            )}
          </p>
        </div>
      </Link>
    </article>
  )
}
