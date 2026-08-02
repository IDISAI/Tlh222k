import { requireCmsRole } from "@/lib/auth"
import { ROADMAPS_PATH } from "@/lib/paths"
import { RoadmapListClient } from "./roadmap-list-client"

export const metadata = { title: "Quản lý Roadmap" }

export default async function RoadmapsPage() {
  // Server-side gate (Req 1.2) — also covers the dev auth bypass, where the
  // proxy is a plain pass-through.
  const role = await requireCmsRole()

  return (
    <div className="container mx-auto px-4 py-8">
      <RoadmapListClient role={role} builderBasePath={ROADMAPS_PATH} />
    </div>
  )
}
