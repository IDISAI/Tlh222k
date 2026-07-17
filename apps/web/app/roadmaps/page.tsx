import { RoadmapList } from "@workspace/core"

export default function RoadmapsPage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-4xl font-black uppercase tracking-tight">
        Learn to code
      </h1>
      <p className="mb-8 text-muted-foreground">Choose your path.</p>
      <RoadmapList />
    </main>
  )
}
