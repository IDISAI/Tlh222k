import { PrismaClient } from "@prisma/client"

// Seed mirrors packages/core/src/roadmap/mock (frontend/backend/devops
// published + ai-engineer draft), preserving ids/slugs/positions/order so the
// graph layout is identical to the mock. Kept inline (no @workspace/core import)
// to avoid pulling React/client code into this node script.

const prisma = new PrismaClient()

interface SeedRoadmap {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  isPublished: boolean
}

interface SeedNode {
  id: string
  roadmapId: string
  parentId: string | null
  nodeType: "role" | "skill" | "chapter" | "article"
  title: string
  slug: string
  x: number
  y: number
  order: number
  description?: string
  notionPageId?: string
  articleType?: "notion" | "jupyter"
  jupyterUrl?: string
}

const roadmaps: SeedRoadmap[] = [
  {
    id: "rm-frontend",
    slug: "frontend",
    title: "Frontend Developer",
    description:
      "Học HTML, CSS và JavaScript rồi tiến tới các framework hiện đại như React để xây dựng giao diện người dùng tương tác, có khả năng truy cập tốt, hiệu năng cao và responsive trên mọi thiết bị.",
    thumbnailUrl: "https://placehold.co/600x338/6366f1/ffffff?text=Frontend",
    isPublished: true,
  },
  {
    id: "rm-backend",
    slug: "backend",
    title: "Backend Developer",
    description: "Node.js, cơ sở dữ liệu, thiết kế API và xác thực.",
    thumbnailUrl: null,
    isPublished: true,
  },
  {
    id: "rm-devops",
    slug: "devops",
    title: "DevOps",
    description: "Linux, Docker, CI/CD và Kubernetes cho vận hành hiện đại.",
    thumbnailUrl: "https://placehold.co/600x338/10b981/ffffff?text=DevOps",
    isPublished: true,
  },
  {
    id: "rm-ai",
    slug: "ai-engineer",
    title: "AI Engineer",
    description: "Bản nháp lộ trình AI Engineer — chưa xuất bản.",
    thumbnailUrl: null,
    isPublished: false,
  },
]

const nodes: SeedNode[] = [
  // ── frontend ──
  { id: "fe-role", roadmapId: "rm-frontend", parentId: null, nodeType: "role", title: "Frontend Developer", slug: "frontend-developer", x: 460, y: 0, order: 0, description: "Lộ trình trở thành lập trình viên frontend: từ HTML/CSS đến framework hiện đại." },
  { id: "fe-sk-web", roadmapId: "rm-frontend", parentId: "fe-role", nodeType: "skill", title: "HTML & CSS", slug: "html-css", x: 200, y: 160, order: 1, description: "Các kỹ năng nền tảng để dựng và trang trí giao diện web." },
  { id: "fe-sk-js", roadmapId: "rm-frontend", parentId: "fe-role", nodeType: "skill", title: "JavaScript", slug: "javascript", x: 720, y: 160, order: 2, description: "Ngôn ngữ lập trình của trình duyệt — nền tảng cho mọi framework." },
  { id: "fe-ch-html", roadmapId: "rm-frontend", parentId: "fe-sk-web", nodeType: "chapter", title: "Nhập môn HTML", slug: "nhap-mon-html", x: 60, y: 320, order: 3, description: "Cấu trúc tài liệu, thẻ ngữ nghĩa và form cơ bản." },
  { id: "fe-ch-css", roadmapId: "rm-frontend", parentId: "fe-sk-web", nodeType: "chapter", title: "CSS Layout", slug: "css-layout", x: 340, y: 320, order: 4, description: "Flexbox, Grid và responsive design." },
  { id: "fe-ch-jsbasic", roadmapId: "rm-frontend", parentId: "fe-sk-js", nodeType: "chapter", title: "JavaScript căn bản", slug: "javascript-can-ban", x: 600, y: 320, order: 5 },
  { id: "fe-ch-react", roadmapId: "rm-frontend", parentId: "fe-sk-js", nodeType: "chapter", title: "React", slug: "react", x: 880, y: 320, order: 6, description: "Thư viện UI theo component với hooks và state." },
  { id: "fe-ar-html", roadmapId: "rm-frontend", parentId: "fe-ch-html", nodeType: "article", title: "HTML cơ bản", slug: "html-co-ban", x: 60, y: 480, order: 7, articleType: "notion", notionPageId: "notion-html", description: "Tài liệu Notion về cấu trúc trang HTML." },
  { id: "fe-ar-a11y", roadmapId: "rm-frontend", parentId: "fe-ch-html", nodeType: "article", title: "Accessibility", slug: "accessibility", x: 60, y: 620, order: 8, articleType: "notion", notionPageId: "notion-a11y" },
  { id: "fe-ar-grid", roadmapId: "rm-frontend", parentId: "fe-ch-css", nodeType: "article", title: "CSS Grid Lab", slug: "css-grid-lab", x: 340, y: 480, order: 9, articleType: "jupyter", jupyterUrl: "https://colab.research.google.com/drive/css-grid-lab", description: "Notebook thực hành dựng layout với CSS Grid." },
  { id: "fe-ar-flex", roadmapId: "rm-frontend", parentId: "fe-ch-css", nodeType: "article", title: "Flexbox", slug: "flexbox", x: 340, y: 620, order: 10 },
  { id: "fe-ar-var", roadmapId: "rm-frontend", parentId: "fe-ch-jsbasic", nodeType: "article", title: "Biến & kiểu dữ liệu", slug: "bien-kieu-du-lieu", x: 600, y: 480, order: 11, articleType: "notion", notionPageId: "notion-javascript" },
  { id: "fe-ar-hook", roadmapId: "rm-frontend", parentId: "fe-ch-react", nodeType: "article", title: "useEffect Deep Dive", slug: "useeffect-deep-dive", x: 880, y: 480, order: 12, articleType: "jupyter", jupyterUrl: "https://colab.research.google.com/drive/useeffect-deep-dive", description: "Tìm hiểu sâu về useEffect hook, cleanup function và dependency array." },
  { id: "fe-ar-query", roadmapId: "rm-frontend", parentId: "fe-ch-react", nodeType: "article", title: "React Query Guide", slug: "react-query-guide", x: 880, y: 620, order: 13, articleType: "notion" },

  // ── backend ──
  { id: "be-role", roadmapId: "rm-backend", parentId: null, nodeType: "role", title: "Backend Developer", slug: "backend-developer", x: 320, y: 0, order: 0, description: "Lộ trình backend: Node.js, cơ sở dữ liệu, API và xác thực." },
  { id: "be-sk-node", roadmapId: "rm-backend", parentId: "be-role", nodeType: "skill", title: "Node.js", slug: "node-js", x: 160, y: 160, order: 1, description: "Nền tảng runtime JavaScript phía server." },
  { id: "be-sk-db", roadmapId: "rm-backend", parentId: "be-role", nodeType: "skill", title: "Cơ sở dữ liệu", slug: "co-so-du-lieu", x: 480, y: 160, order: 2 },
  { id: "be-ch-nodecore", roadmapId: "rm-backend", parentId: "be-sk-node", nodeType: "chapter", title: "Nền tảng Node", slug: "nen-tang-node", x: 160, y: 320, order: 3 },
  { id: "be-ch-api", roadmapId: "rm-backend", parentId: "be-sk-node", nodeType: "chapter", title: "Thiết kế API", slug: "thiet-ke-api", x: 320, y: 460, order: 4 },
  { id: "be-ch-sql", roadmapId: "rm-backend", parentId: "be-sk-db", nodeType: "chapter", title: "SQL cơ bản", slug: "sql-co-ban", x: 480, y: 320, order: 5 },
  { id: "be-ar-node", roadmapId: "rm-backend", parentId: "be-ch-nodecore", nodeType: "article", title: "Node.js Runtime", slug: "node-js-runtime", x: 160, y: 460, order: 6, articleType: "notion", notionPageId: "notion-nodejs" },
  { id: "be-ar-rest", roadmapId: "rm-backend", parentId: "be-ch-api", nodeType: "article", title: "RESTful APIs", slug: "restful-apis", x: 320, y: 600, order: 7, articleType: "notion", notionPageId: "notion-apis" },
  { id: "be-ar-auth", roadmapId: "rm-backend", parentId: "be-ch-api", nodeType: "article", title: "Authentication", slug: "authentication", x: 520, y: 600, order: 8, articleType: "notion", notionPageId: "notion-auth" },
  { id: "be-ar-sql", roadmapId: "rm-backend", parentId: "be-ch-sql", nodeType: "article", title: "Truy vấn SQL Lab", slug: "truy-van-sql-lab", x: 480, y: 460, order: 9, articleType: "jupyter", jupyterUrl: "https://colab.research.google.com/drive/sql-lab" },

  // ── devops ──
  { id: "do-role", roadmapId: "rm-devops", parentId: null, nodeType: "role", title: "DevOps Engineer", slug: "devops-engineer", x: 320, y: 0, order: 0, description: "Vận hành hiện đại: Linux, container, CI/CD và Kubernetes." },
  { id: "do-sk-linux", roadmapId: "rm-devops", parentId: "do-role", nodeType: "skill", title: "Linux", slug: "linux", x: 160, y: 160, order: 1 },
  { id: "do-sk-container", roadmapId: "rm-devops", parentId: "do-role", nodeType: "skill", title: "Containers", slug: "containers", x: 480, y: 160, order: 2 },
  { id: "do-ch-shell", roadmapId: "rm-devops", parentId: "do-sk-linux", nodeType: "chapter", title: "Shell & CLI", slug: "shell-cli", x: 160, y: 320, order: 3 },
  { id: "do-ch-docker", roadmapId: "rm-devops", parentId: "do-sk-container", nodeType: "chapter", title: "Docker", slug: "docker", x: 480, y: 320, order: 4 },
  { id: "do-ar-linux", roadmapId: "rm-devops", parentId: "do-ch-shell", nodeType: "article", title: "Linux cơ bản", slug: "linux-co-ban", x: 160, y: 460, order: 5, articleType: "notion", notionPageId: "notion-linux" },
  { id: "do-ar-docker", roadmapId: "rm-devops", parentId: "do-ch-docker", nodeType: "article", title: "Docker hands-on", slug: "docker-hands-on", x: 480, y: 460, order: 6, articleType: "notion", notionPageId: "notion-docker" },
]

async function main() {
  // Idempotent reset: wipe then re-seed so `pnpm seed` is repeatable.
  await prisma.userProgress.deleteMany()
  await prisma.node.deleteMany()
  await prisma.roadmap.deleteMany()

  for (const r of roadmaps) {
    await prisma.roadmap.create({ data: r })
  }

  // Parent-before-child (array already ordered) so the self-relation FK holds.
  for (const n of nodes) {
    await prisma.node.create({
      data: {
        id: n.id,
        roadmapId: n.roadmapId,
        parentId: n.parentId,
        nodeType: n.nodeType,
        title: n.title,
        slug: n.slug,
        positionX: n.x,
        positionY: n.y,
        order: n.order,
        description: n.description ?? null,
        notionPageId: n.notionPageId ?? null,
        articleType: n.articleType ?? null,
        jupyterUrl: n.jupyterUrl ?? null,
      },
    })
  }

  console.log(
    `Seeded ${roadmaps.length} roadmaps and ${nodes.length} nodes.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
