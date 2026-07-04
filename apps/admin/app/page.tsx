import { GraphView, NotionView } from "@workspace/core"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <h1 className="font-medium">Admin</h1>
      {/* Features mounted from @workspace/core */}
      <div className="h-[85svh]">
        <NotionView />
      </div>
      <GraphView />
    </div>
  )
}
