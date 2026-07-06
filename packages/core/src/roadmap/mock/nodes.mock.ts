import type { RoadmapNode } from "../types"

// Base node trees keyed by roadmap slug. `status` is always "locked" here — the
// service overlays a viewer's real status (Property 4 keeps guests all-locked).
// ponytail: replace with the `roadmapGraph(slug)` GraphQL query.

type BaseNode = Omit<RoadmapNode, "status">

const withStatus = (nodes: BaseNode[]): RoadmapNode[] =>
  nodes.map((n) => ({ ...n, status: "locked" }))

const frontend: BaseNode[] = [
  { id: "fe-internet", roadmapId: "rm-frontend", parentId: null, title: "Internet", notionPageId: "notion-internet", positionX: 320, positionY: 0, order: 0 },
  { id: "fe-html", roadmapId: "rm-frontend", parentId: "fe-internet", title: "HTML", notionPageId: "notion-html", positionX: 320, positionY: 140, order: 1 },
  { id: "fe-git", roadmapId: "rm-frontend", parentId: "fe-internet", title: "Version Control (Git)", notionPageId: null, positionX: 600, positionY: 140, order: 2 },
  { id: "fe-css", roadmapId: "rm-frontend", parentId: "fe-html", title: "CSS", notionPageId: "notion-css", positionX: 160, positionY: 280, order: 3 },
  { id: "fe-js", roadmapId: "rm-frontend", parentId: "fe-html", title: "JavaScript", notionPageId: "notion-javascript", positionX: 460, positionY: 280, order: 4 },
  { id: "fe-a11y", roadmapId: "rm-frontend", parentId: "fe-css", title: "Accessibility", notionPageId: "notion-a11y", positionX: 160, positionY: 420, order: 5 },
  { id: "fe-react", roadmapId: "rm-frontend", parentId: "fe-js", title: "React", notionPageId: "notion-react", positionX: 460, positionY: 420, order: 6 },
]

const backend: BaseNode[] = [
  { id: "be-internet", roadmapId: "rm-backend", parentId: null, title: "Internet", notionPageId: "notion-internet", positionX: 320, positionY: 0, order: 0 },
  { id: "be-node", roadmapId: "rm-backend", parentId: "be-internet", title: "Node.js", notionPageId: "notion-nodejs", positionX: 320, positionY: 140, order: 1 },
  { id: "be-db", roadmapId: "rm-backend", parentId: "be-node", title: "Databases", notionPageId: "notion-databases", positionX: 160, positionY: 280, order: 2 },
  { id: "be-api", roadmapId: "rm-backend", parentId: "be-node", title: "APIs", notionPageId: "notion-apis", positionX: 460, positionY: 280, order: 3 },
  { id: "be-auth", roadmapId: "rm-backend", parentId: "be-api", title: "Authentication", notionPageId: "notion-auth", positionX: 460, positionY: 420, order: 4 },
]

const devops: BaseNode[] = [
  { id: "do-linux", roadmapId: "rm-devops", parentId: null, title: "Linux", notionPageId: "notion-linux", positionX: 320, positionY: 0, order: 0 },
  { id: "do-docker", roadmapId: "rm-devops", parentId: "do-linux", title: "Docker", notionPageId: "notion-docker", positionX: 320, positionY: 140, order: 1 },
  { id: "do-cicd", roadmapId: "rm-devops", parentId: "do-docker", title: "CI/CD", notionPageId: "notion-cicd", positionX: 320, positionY: 280, order: 2 },
  { id: "do-k8s", roadmapId: "rm-devops", parentId: "do-cicd", title: "Kubernetes", notionPageId: "notion-k8s", positionX: 320, positionY: 420, order: 3 },
]

export const MOCK_NODES: Record<string, RoadmapNode[]> = {
  frontend: withStatus(frontend),
  backend: withStatus(backend),
  devops: withStatus(devops),
}
