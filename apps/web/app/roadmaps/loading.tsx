import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return (
    <>
      <section className="px-5 pb-2 pt-14 md:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Skeleton className="mx-auto mb-8 h-9 w-[min(560px,90%)]" />
          <Skeleton className="mx-auto h-16 max-w-[800px] rounded-full" />
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1280px] px-5 pb-16 pt-14 md:px-10">
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 min-[744px]:grid-cols-2 min-[1128px]:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[16/10] rounded-[14px]" />
          ))}
        </div>
      </main>
    </>
  )
}
