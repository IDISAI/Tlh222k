import { PrismaClient } from "@prisma/client"

// "Jupyter Notebook Platform" roadmap — mô tả toàn bộ tính năng của nền tảng.
// Idempotent (upsert by id). Run: `pnpm -F @workspace/db seed:jupyter`
// Mỗi article node là một jupyter notebook trên kernel-server (slug phải khớp).

const prisma = new PrismaClient()

const roadmap = {
  id: "rm-jupyter-platform",
  slug: "jupyter-platform",
  title: "Jupyter Notebook Platform",
  description:
    "Toàn bộ tính năng của nền tảng Jupyter: từ tạo và chỉnh sửa notebook đến thực thi code, trực quan hóa và xuất bản — mỗi bài là một notebook tương tác.",
  thumbnailUrl:
    "https://placehold.co/600x338/0ea5e9/ffffff?text=Jupyter+Platform",
  isPublished: true,
}

interface SeedNode {
  id: string
  parentId: string | null
  nodeType: "role" | "skill" | "chapter" | "article"
  title: string
  slug: string
  x: number
  y: number
  order: number
  description?: string
  articleType?: "notion" | "jupyter"
}

const nodes: SeedNode[] = [
  // ─── ROOT ROLE ────────────────────────────────────────────────────────────
  {
    id: "jup-role",
    parentId: null,
    nodeType: "role",
    title: "Jupyter Notebook Platform",
    slug: "jupyter-platform-root",
    x: 660,
    y: 0,
    order: 0,
    description:
      "Nền tảng notebook tương tác: tạo, chỉnh sửa, thực thi code Python và xuất bản bài học lên web.",
  },

  // ─── SKILL 1: Tạo & quản lý ────────────────────────────────────────────
  {
    id: "jup-sk-editor",
    parentId: "jup-role",
    nodeType: "skill",
    title: "Tạo & Quản lý Notebook",
    slug: "jup-tao-quan-ly",
    x: 120,
    y: 160,
    order: 1,
    description:
      "Tạo notebook mới, chỉnh sửa cells, lưu tự động và quản lý danh sách notebook.",
  },
  {
    id: "jup-ch-admin",
    parentId: "jup-sk-editor",
    nodeType: "chapter",
    title: "Admin Editor",
    slug: "jup-admin-editor",
    x: 0,
    y: 320,
    order: 2,
    description: "Giao diện soạn thảo notebook dành cho admin.",
  },
  {
    id: "jup-ar-create",
    parentId: "jup-ch-admin",
    nodeType: "article",
    title: "Tạo notebook mới",
    slug: "tao-notebook-moi",
    x: 0,
    y: 480,
    order: 3,
    articleType: "jupyter",
    description: "Tạo notebook từ trang /notebooks, đặt tiêu đề và lưu tự động.",
  },
  {
    id: "jup-ar-cells",
    parentId: "jup-ch-admin",
    nodeType: "article",
    title: "Thêm & chỉnh sửa cells",
    slug: "them-chinh-sua-cells",
    x: 0,
    y: 620,
    order: 4,
    articleType: "jupyter",
    description:
      "Thêm code cell / markdown cell, di chuyển, nhân bản, xóa — và undo/redo.",
  },
  {
    id: "jup-ch-viewer",
    parentId: "jup-sk-editor",
    nodeType: "chapter",
    title: "Web Viewer",
    slug: "jup-web-viewer",
    x: 240,
    y: 320,
    order: 5,
    description: "Trang /learn/[slug] cho người học xem và chạy notebook.",
  },
  {
    id: "jup-ar-viewer",
    parentId: "jup-ch-viewer",
    nodeType: "article",
    title: "Xem notebook trên /learn",
    slug: "xem-notebook-learn",
    x: 240,
    y: 480,
    order: 6,
    articleType: "jupyter",
    description:
      "TOC sidebar, Tutorial/Exercise tabs, heading anchors và scroll-spy.",
  },

  // ─── SKILL 2: Thực thi code ────────────────────────────────────────────
  {
    id: "jup-sk-exec",
    parentId: "jup-role",
    nodeType: "skill",
    title: "Thực thi Code",
    slug: "jup-thuc-thi-code",
    x: 540,
    y: 160,
    order: 7,
    description:
      "Chạy Python trên kernel thật (Docker): stream stdout, biểu đồ Matplotlib, xử lý lỗi.",
  },
  {
    id: "jup-ch-kernel",
    parentId: "jup-sk-exec",
    nodeType: "chapter",
    title: "Kernel & Sessions",
    slug: "jup-kernel-sessions",
    x: 420,
    y: 320,
    order: 8,
    description: "Quản lý kernel session: khởi động, interrupt, restart.",
  },
  {
    id: "jup-ar-run",
    parentId: "jup-ch-kernel",
    nodeType: "article",
    title: "Chạy code cell & Run All",
    slug: "chay-code-run-all",
    x: 420,
    y: 480,
    order: 9,
    articleType: "jupyter",
    description:
      "Click Run (▷) chạy 1 cell; Run All chạy toàn bộ — output stream real-time.",
  },
  {
    id: "jup-ar-interrupt",
    parentId: "jup-ch-kernel",
    nodeType: "article",
    title: "Interrupt & Restart kernel",
    slug: "interrupt-restart-kernel",
    x: 420,
    y: 620,
    order: 10,
    articleType: "jupyter",
    description:
      "Dừng cell đang chạy (Interrupt) hoặc reset toàn bộ biến (Restart).",
  },
  {
    id: "jup-ch-output",
    parentId: "jup-sk-exec",
    nodeType: "chapter",
    title: "Outputs & Trực quan hóa",
    slug: "jup-outputs",
    x: 660,
    y: 320,
    order: 11,
    description: "Stdout streaming, Matplotlib PNG, error traceback với màu ANSI.",
  },
  {
    id: "jup-ar-matplotlib",
    parentId: "jup-ch-output",
    nodeType: "article",
    title: "Biểu đồ Matplotlib",
    slug: "bieu-do-matplotlib",
    x: 660,
    y: 480,
    order: 12,
    articleType: "jupyter",
    description: "Vẽ line/scatter/bar chart — hình PNG hiện ngay trong cell output.",
  },
  {
    id: "jup-ar-traceback",
    parentId: "jup-ch-output",
    nodeType: "article",
    title: "Xử lý lỗi & traceback",
    slug: "xu-ly-loi-traceback",
    x: 660,
    y: 620,
    order: 13,
    articleType: "jupyter",
    description:
      "Traceback có màu ANSI, nền đỏ nhạt — đọc lỗi nhanh và sửa ngay.",
  },

  // ─── SKILL 3: Soạn nội dung ────────────────────────────────────────────
  {
    id: "jup-sk-content",
    parentId: "jup-role",
    nodeType: "skill",
    title: "Soạn Nội dung",
    slug: "jup-soan-noi-dung",
    x: 960,
    y: 160,
    order: 14,
    description:
      "Code cells với syntax highlight; Markdown cells với preview song song và toolbar định dạng.",
  },
  {
    id: "jup-ch-markdown",
    parentId: "jup-sk-content",
    nodeType: "chapter",
    title: "Markdown Cells",
    slug: "jup-markdown-cells",
    x: 880,
    y: 320,
    order: 15,
    description: "Chỉnh sửa markdown với CodeMirror 6 + preview split-pane.",
  },
  {
    id: "jup-ar-markdown",
    parentId: "jup-ch-markdown",
    nodeType: "article",
    title: "Markdown với syntax highlight",
    slug: "markdown-syntax-highlight",
    x: 880,
    y: 480,
    order: 16,
    articleType: "jupyter",
    description:
      "Gõ markdown và thấy heading/bold/code highlight ngay; Shift+Enter để render.",
  },
  {
    id: "jup-ch-code",
    parentId: "jup-sk-content",
    nodeType: "chapter",
    title: "Code Cells",
    slug: "jup-code-cells",
    x: 1060,
    y: 320,
    order: 17,
    description: "CodeMirror 6 với Python syntax highlight và Shift+Enter advance.",
  },
  {
    id: "jup-ar-code",
    parentId: "jup-ch-code",
    nodeType: "article",
    title: "Code cell & phím tắt",
    slug: "code-cell-phim-tat",
    x: 1060,
    y: 480,
    order: 18,
    articleType: "jupyter",
    description:
      "Shift+Enter chạy và xuống cell; Ctrl+Z undo; accent bar xanh cho cell đang chọn.",
  },

  // ─── SKILL 4: Xuất bản & Chia sẻ ──────────────────────────────────────
  {
    id: "jup-sk-publish",
    parentId: "jup-role",
    nodeType: "skill",
    title: "Xuất bản & Chia sẻ",
    slug: "jup-xuat-ban",
    x: 1260,
    y: 160,
    order: 19,
    description: "Xuất bản notebook lên /learn, copy link chia sẻ và tạo exercise.",
  },
  {
    id: "jup-ch-pub",
    parentId: "jup-sk-publish",
    nodeType: "chapter",
    title: "Publishing",
    slug: "jup-publishing",
    x: 1180,
    y: 320,
    order: 20,
    description: "Xuất bản / hủy xuất bản, copy URL /learn.",
  },
  {
    id: "jup-ar-publish",
    parentId: "jup-ch-pub",
    nodeType: "article",
    title: "Xuất bản notebook",
    slug: "xuat-ban-notebook",
    x: 1180,
    y: 480,
    order: 21,
    articleType: "jupyter",
    description:
      "Bấm \"Xuất bản\" → popover hiện URL /learn — copy và chia sẻ cho người học.",
  },
  {
    id: "jup-ch-exercise",
    parentId: "jup-sk-publish",
    nodeType: "chapter",
    title: "Exercise Notebooks",
    slug: "jup-exercise-notebooks",
    x: 1360,
    y: 320,
    order: 22,
    description: "Tạo notebook exercise (slug: {tutorial}-exercise) kích hoạt tab Exercise.",
  },
  {
    id: "jup-ar-exercise",
    parentId: "jup-ch-exercise",
    nodeType: "article",
    title: "Tạo exercise cho người học",
    slug: "tao-exercise-nguoi-hoc",
    x: 1360,
    y: 480,
    order: 23,
    articleType: "jupyter",
    description:
      "Tạo notebook slug {tutorial-slug}-exercise → publish → Tab Exercise tự kích hoạt trên /learn.",
  },
]

async function main() {
  await prisma.roadmap.upsert({
    where: { id: roadmap.id },
    create: roadmap,
    update: roadmap,
  })
  for (const n of nodes) {
    const data = {
      roadmapId: roadmap.id,
      parentId: n.parentId,
      title: n.title,
      slug: n.slug,
      description: n.description ?? null,
      nodeType: n.nodeType,
      articleType: n.articleType ?? null,
      positionX: n.x,
      positionY: n.y,
      order: n.order,
      isDeleted: false,
    }
    await prisma.node.upsert({
      where: { id: n.id },
      create: { id: n.id, ...data },
      update: data,
    })
  }
  console.log(`Seeded roadmap "${roadmap.title}" with ${nodes.length} nodes`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
