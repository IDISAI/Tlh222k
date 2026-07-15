import type { Edge, Node } from "@xyflow/react"

import type { RoadmapNode } from "../types"

/** React Flow node specialization for the editable builder canvas. */
export type BuilderFlowNode = Node<
  {
    node: RoadmapNode
    /**
     * True inside ViewerCanvas — unlinked notion articles render disabled
     * (notion-article-node Req 6.2).
     */
    viewerMode?: boolean
  },
  "builderNode"
>

/** Edge carrying the target node's direct-children count badge (Req 3.9). */
export type ChildCountEdge = Edge<{ count: number }, "childCount">

/** Screen + flow coordinates captured from a context-menu event. */
export interface CanvasMenuPosition {
  screenX: number
  screenY: number
  flowX: number
  flowY: number
}

/** DataTransfer MIME type for sidebar → canvas drags (Req 3.4). */
export const NODE_DND_MIME = "application/x-roadmap-node"
