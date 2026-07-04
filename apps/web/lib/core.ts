// apps/ = nơi import logic từ packages/core và custom lại cho từng app.
// Ví dụ: bọc RoadmapService của core, thêm hành vi riêng của web.
import { RoadmapService, type Roadmap } from "@workspace/core"

const roadmaps = new RoadmapService()

/** Custom cho web: chỉ lấy roadmap đã publish (lọc phía app). */
export async function listPublishedRoadmaps(): Promise<Roadmap[]> {
  const all = await roadmaps.list()
  // ponytail: filter thật khi Roadmap có field `status`
  return all
}
