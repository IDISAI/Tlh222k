export type NodeStatus = "locked" | "in_progress" | "done"

export interface Roadmap {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  isPublished: boolean
  nodeCount: number
}

export interface RoadmapNode {
  id: string
  roadmapId: string
  parentId: string | null
  title: string
  notionPageId: string | null
  positionX: number
  positionY: number
  order: number
  /** Personalized per viewer; "locked" for guests (Property 4). */
  status: NodeStatus
}

export interface RoadmapGraph {
  roadmap: Roadmap
  nodes: RoadmapNode[]
}

export interface RoadmapProgress {
  roadmapId: string
  roadmapTitle: string
  doneCount: number
  totalCount: number
}
