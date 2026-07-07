import type { Node } from "@xyflow/react"

import type { RoadmapNode } from "../types"

export interface Graph {
  id: string
  title: string
}

/** React Flow node specialization carrying a domain `RoadmapNode`. */
export type RoadmapFlowNode = Node<{ node: RoadmapNode }, "roadmapNode">
