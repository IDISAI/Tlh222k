import type { Roadmap } from "../types"
import { MOCK_NODES } from "./nodes.mock"

/** Reused author stubs so the mock stays compact (roadmap-detail-columns spec). */
const MOCK_AUTHORS = {
  linh: { id: "user-001", name: "Nguyễn Thị Linh" },
  minh: { id: "user-002", name: "Trần Văn Minh" },
  system: { id: "user-000", name: "System" },
} as const

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
    fields: [],
    createdAt: "2024-01-15T08:00:00.000Z",
    updatedAt: "2024-06-20T14:30:00.000Z", // > 24h → dd/MM/yyyy
    authorId: MOCK_AUTHORS.linh.id,
    author: MOCK_AUTHORS.linh,
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
    fields: [],
    createdAt: "2024-02-10T10:00:00.000Z",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // ~2h ago
    authorId: MOCK_AUTHORS.minh.id,
    author: MOCK_AUTHORS.minh,
  },
  {
    id: "rm-devops",
    slug: "devops",
    title: "DevOps",
    description: "Linux, Docker, CI/CD và Kubernetes cho vận hành hiện đại.",
    thumbnailUrl: "https://placehold.co/600x338/10b981/ffffff?text=DevOps",
    isPublished: true,
    nodeCount: MOCK_NODES.devops?.length ?? 0,
    fields: [],
    createdAt: "2023-11-01T09:00:00.000Z",
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // ~30m ago
    authorId: MOCK_AUTHORS.system.id,
    author: MOCK_AUTHORS.system,
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
    fields: [],
    createdAt: "2025-03-05T12:00:00.000Z",
    updatedAt: "2025-03-05T12:00:00.000Z",
    authorId: MOCK_AUTHORS.linh.id,
    author: MOCK_AUTHORS.linh,
  },
]
