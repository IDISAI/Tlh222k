import { GraphView } from "@workspace/core"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <h1 className="font-medium">Admin</h1>
      <GraphView />
    </div>
  )
}
