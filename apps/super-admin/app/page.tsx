import { NotionView, RoadmapView } from "@workspace/core"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <h1 className="font-medium">Super Admin</h1>
      {/* Features mounted from @workspace/core */}
      <RoadmapView />
      <NotionView />
    </div>
  )
}
