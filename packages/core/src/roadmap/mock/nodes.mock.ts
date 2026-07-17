import type { ArticleType, NodeType, RoadmapNode } from "../types"

// Base node trees keyed by roadmap slug, following the 4-level hierarchy
// role → skill → chapter → article (Req 2). `status` is always "locked" here —
// the service overlays a viewer's real status (Property 4 keeps guests
// all-locked). Some articles are deliberately unlinked (articleType/pageId
// null) to exercise the ⚠️ "Tài liệu chưa được liên kết" states (Req 6.6).
// ponytail: replace with the `roadmapGraph(slug)` GraphQL query.

type BaseNode = Omit<RoadmapNode, "status">

const withStatus = (nodes: BaseNode[]): RoadmapNode[] =>
  nodes.map((n) => ({ ...n, status: "locked" }))

/** Terse row builder so the trees below stay readable. */
function node(
  id: string,
  roadmapId: string,
  parentId: string | null,
  nodeType: NodeType,
  title: string,
  slug: string,
  pos: [number, number],
  order: number,
  opts: {
    description?: string
    notionPageId?: string
    articleType?: ArticleType
    jupyterUrl?: string
  } = {}
): BaseNode {
  return {
    id,
    roadmapId,
    parentId,
    nodeType,
    title,
    slug,
    positionX: pos[0],
    positionY: pos[1],
    order,
    description: opts.description ?? null,
    notionPageId: opts.notionPageId ?? null,
    articleType: opts.articleType ?? null,
    jupyterUrl: opts.jupyterUrl ?? null,
  }
}

const frontend: BaseNode[] = [
  node("fe-role", "rm-frontend", null, "role", "Frontend Developer", "frontend-developer", [460, 0], 0, {
    description: "Lộ trình trở thành lập trình viên frontend: từ HTML/CSS đến framework hiện đại.",
  }),
  node("fe-sk-web", "rm-frontend", "fe-role", "skill", "HTML & CSS", "html-css", [200, 160], 1, {
    description: "Các kỹ năng nền tảng để dựng và trang trí giao diện web.",
  }),
  node("fe-sk-js", "rm-frontend", "fe-role", "skill", "JavaScript", "javascript", [720, 160], 2, {
    description: "Ngôn ngữ lập trình của trình duyệt — nền tảng cho mọi framework.",
  }),
  node("fe-ch-html", "rm-frontend", "fe-sk-web", "chapter", "Nhập môn HTML", "nhap-mon-html", [60, 320], 3, {
    description: "Cấu trúc tài liệu, thẻ ngữ nghĩa và form cơ bản.",
  }),
  node("fe-ch-css", "rm-frontend", "fe-sk-web", "chapter", "CSS Layout", "css-layout", [340, 320], 4, {
    description: "Flexbox, Grid và responsive design.",
  }),
  node("fe-ch-jsbasic", "rm-frontend", "fe-sk-js", "chapter", "JavaScript căn bản", "javascript-can-ban", [600, 320], 5),
  node("fe-ch-react", "rm-frontend", "fe-sk-js", "chapter", "React", "react", [880, 320], 6, {
    description: "Thư viện UI theo component với hooks và state.",
  }),
  node("fe-ar-html", "rm-frontend", "fe-ch-html", "article", "HTML cơ bản", "html-co-ban", [60, 480], 7, {
    articleType: "notion",
    notionPageId: "notion-html",
    description: "Tài liệu Notion về cấu trúc trang HTML.",
  }),
  node("fe-ar-a11y", "rm-frontend", "fe-ch-html", "article", "Accessibility", "accessibility", [60, 620], 8, {
    articleType: "notion",
    notionPageId: "notion-a11y",
  }),
  node("fe-ar-grid", "rm-frontend", "fe-ch-css", "article", "CSS Grid Lab", "css-grid-lab", [340, 480], 9, {
    articleType: "jupyter",
    jupyterUrl: "https://colab.research.google.com/drive/css-grid-lab",
    description: "Notebook thực hành dựng layout với CSS Grid.",
  }),
  // Unlinked article → ⚠️ badge + no navigation (Req 6.6).
  node("fe-ar-flex", "rm-frontend", "fe-ch-css", "article", "Flexbox", "flexbox", [340, 620], 10),
  node("fe-ar-var", "rm-frontend", "fe-ch-jsbasic", "article", "Biến & kiểu dữ liệu", "bien-kieu-du-lieu", [600, 480], 11, {
    articleType: "notion",
    notionPageId: "notion-javascript",
  }),
  node("fe-ar-hook", "rm-frontend", "fe-ch-react", "article", "useEffect Deep Dive", "useeffect-deep-dive", [880, 480], 12, {
    articleType: "jupyter",
    jupyterUrl: "https://colab.research.google.com/drive/useeffect-deep-dive",
    description: "Tìm hiểu sâu về useEffect hook, cleanup function và dependency array.",
  }),
  // articleType chosen but page id missing → also the unlinked ⚠️ case.
  node("fe-ar-query", "rm-frontend", "fe-ch-react", "article", "React Query Guide", "react-query-guide", [880, 620], 13, {
    articleType: "notion",
  }),
  // jupyter with NO url → opens the INTERNAL notebook viewer at /learn/[slug].
  node("fe-ar-arith", "rm-frontend", "fe-ch-jsbasic", "article", "Arithmetic and Variables", "arithmetic-and-variables", [600, 620], 14, {
    articleType: "jupyter",
    description: "Notebook nội bộ: số học, biến và debugging cơ bản với Python.",
  }),
]

const backend: BaseNode[] = [
  node("be-role", "rm-backend", null, "role", "Backend Developer", "backend-developer", [320, 0], 0, {
    description: "Lộ trình backend: Node.js, cơ sở dữ liệu, API và xác thực.",
  }),
  node("be-sk-node", "rm-backend", "be-role", "skill", "Node.js", "node-js", [160, 160], 1, {
    description: "Nền tảng runtime JavaScript phía server.",
  }),
  node("be-sk-db", "rm-backend", "be-role", "skill", "Cơ sở dữ liệu", "co-so-du-lieu", [480, 160], 2),
  node("be-ch-nodecore", "rm-backend", "be-sk-node", "chapter", "Nền tảng Node", "nen-tang-node", [160, 320], 3),
  node("be-ch-api", "rm-backend", "be-sk-node", "chapter", "Thiết kế API", "thiet-ke-api", [320, 460], 4),
  node("be-ch-sql", "rm-backend", "be-sk-db", "chapter", "SQL cơ bản", "sql-co-ban", [480, 320], 5),
  node("be-ar-node", "rm-backend", "be-ch-nodecore", "article", "Node.js Runtime", "node-js-runtime", [160, 460], 6, {
    articleType: "notion",
    notionPageId: "notion-nodejs",
  }),
  node("be-ar-rest", "rm-backend", "be-ch-api", "article", "RESTful APIs", "restful-apis", [320, 600], 7, {
    articleType: "notion",
    notionPageId: "notion-apis",
  }),
  node("be-ar-auth", "rm-backend", "be-ch-api", "article", "Authentication", "authentication", [520, 600], 8, {
    articleType: "notion",
    notionPageId: "notion-auth",
  }),
  node("be-ar-sql", "rm-backend", "be-ch-sql", "article", "Truy vấn SQL Lab", "truy-van-sql-lab", [480, 460], 9, {
    articleType: "jupyter",
    jupyterUrl: "https://colab.research.google.com/drive/sql-lab",
  }),
]

const devops: BaseNode[] = [
  node("do-role", "rm-devops", null, "role", "DevOps Engineer", "devops-engineer", [320, 0], 0, {
    description: "Vận hành hiện đại: Linux, container, CI/CD và Kubernetes.",
  }),
  node("do-sk-linux", "rm-devops", "do-role", "skill", "Linux", "linux", [160, 160], 1),
  node("do-sk-container", "rm-devops", "do-role", "skill", "Containers", "containers", [480, 160], 2),
  node("do-ch-shell", "rm-devops", "do-sk-linux", "chapter", "Shell & CLI", "shell-cli", [160, 320], 3),
  node("do-ch-docker", "rm-devops", "do-sk-container", "chapter", "Docker", "docker", [480, 320], 4),
  node("do-ar-linux", "rm-devops", "do-ch-shell", "article", "Linux cơ bản", "linux-co-ban", [160, 460], 5, {
    articleType: "notion",
    notionPageId: "notion-linux",
  }),
  node("do-ar-docker", "rm-devops", "do-ch-docker", "article", "Docker hands-on", "docker-hands-on", [480, 460], 6, {
    articleType: "notion",
    notionPageId: "notion-docker",
  }),
]

export const MOCK_NODES: Record<string, RoadmapNode[]> = {
  frontend: withStatus(frontend),
  backend: withStatus(backend),
  devops: withStatus(devops),
  // Unpublished draft roadmap starts with an empty canvas.
  "ai-engineer": [],
}
