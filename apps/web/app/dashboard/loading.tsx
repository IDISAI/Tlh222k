import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Skeleton className="mb-8 h-10 w-72" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </main>
  )
}
