import type { Roadmap } from "../types"
import { MOCK_NODES } from "./nodes.mock"

// ponytail: replace with the `roadmaps` GraphQL query.
export const MOCK_ROADMAPS: Roadmap[] = [
  {
    id: "rm-frontend",
    slug: "frontend",
    title: "Frontend Developer",
    // Intentionally long (>160 chars) to exercise card truncation (Property 1).
    description:
      "Học HTML, CSS và JavaScript rồi tiến tới các framework hiện đại như React để xây dựng giao diện người dùng tương tác, có khả năng truy cập tốt, hiệu năng cao và responsive trên mọi thiết bị.",
    thumbnailUrl: "https://placehold.co/600x338/6366f1/ffffff?text=Frontend",
    isPublished: true,
    nodeCount: MOCK_NODES.frontend?.length ?? 0,
  },
  {
    id: "rm-backend",
    slug: "backend",
    title: "Backend Developer",
    description: "Node.js, cơ sở dữ liệu, thiết kế API và xác thực.",
    // No thumbnail → card must render a placeholder.
    thumbnailUrl: null,
    isPublished: true,
    nodeCount: MOCK_NODES.backend?.length ?? 0,
  },
  {
    id: "rm-devops",
    slug: "devops",
    title: "DevOps",
    description: "Linux, Docker, CI/CD và Kubernetes cho vận hành hiện đại.",
    thumbnailUrl: "https://placehold.co/600x338/10b981/ffffff?text=DevOps",
    isPublished: true,
    nodeCount: MOCK_NODES.devops?.length ?? 0,
  },
  {
    // Unpublished draft — only visible in the admin builder list (Req 1.1);
    // `list()` filters it out for viewers.
    id: "rm-ai",
    slug: "ai-engineer",
    title: "AI Engineer",
    description: "Bản nháp lộ trình AI Engineer — chưa xuất bản.",
    thumbnailUrl: null,
    isPublished: false,
    nodeCount: MOCK_NODES["ai-engineer"]?.length ?? 0,
  },
]
