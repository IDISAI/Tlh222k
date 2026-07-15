import { PrismaClient } from "@prisma/client"

// "Data Science Engineer" — ONE complete roadmap that exercises the FULL flow
// end to end on both web and admin: role → skill → chapter → article, with
// BOTH article kinds wired to real, working content:
//
//   • jupyter articles  → slug matches a committed notebook fixture in
//     apps/web/content/notebooks/<slug>.ipynb, so /notebooks/<slug> renders
//     (web viewer) and /notebooks/<slug> opens the editor (admin).
//   • notion articles   → a PUBLISHED Document tree (root doc keyed by the
//     chapter slug + one published child page per article, with real BlockNote
//     content), so /notion/<chapter>?page=<article> renders on web immediately
//     and the same tree opens in the admin editor.
//
// Idempotent: upsert by id, and Documents are reset by id before re-create so
// re-running never duplicates the notion tree. Run:
//   pnpm -F @workspace/db seed:full

const prisma = new PrismaClient()

const ROADMAP = {
  id: "rm-data-science",
  slug: "data-science",
  title: "Data Science Engineer",
  description:
    "Lộ trình đầy đủ từ Python nền tảng đến Machine Learning: mỗi chương gồm bài lý thuyết (Notion) và bài thực hành notebook (Jupyter) chạy trực tiếp trong trình duyệt.",
  thumbnailUrl:
    "https://placehold.co/600x338/8b5cf6/ffffff?text=Data+Science",
  isPublished: true,
}

// ── BlockNote content helpers (PartialBlock[] as JSON string) ───────────────
type Block = Record<string, unknown>
const text = (t: string) => [{ type: "text", text: t, styles: {} }]
const h = (level: 1 | 2 | 3, t: string): Block => ({
  type: "heading",
  props: { level },
  content: text(t),
})
const p = (t: string): Block => ({ type: "paragraph", content: text(t) })
const li = (t: string): Block => ({
  type: "bulletListItem",
  content: text(t),
})
const content = (...b: Block[]) => JSON.stringify(b)

// ── Notion roots (one published Document per chapter that has notion pages) ──
interface NotionRoot {
  chapterSlug: string
  title: string
  icon: string
  intro: string
}
const notionRoots: NotionRoot[] = [
  {
    chapterSlug: "chuong-python",
    title: "Python cơ bản",
    icon: "🐍",
    intro: "Tài liệu nền tảng cho chương Python cơ bản.",
  },
  {
    chapterSlug: "chuong-toan",
    title: "Toán cho ML",
    icon: "📐",
    intro: "Kiến thức toán cần thiết trước khi vào Machine Learning.",
  },
  {
    chapterSlug: "chuong-numpy-pandas",
    title: "NumPy & Pandas",
    icon: "🧮",
    intro: "Hai thư viện xử lý dữ liệu cốt lõi của Python.",
  },
  {
    chapterSlug: "chuong-viz",
    title: "Trực quan hóa",
    icon: "📊",
    intro: "Biến số liệu thành biểu đồ dễ hiểu.",
  },
  {
    chapterSlug: "chuong-supervised",
    title: "Học có giám sát",
    icon: "🎯",
    intro: "Các thuật toán học từ dữ liệu đã gán nhãn.",
  },
  {
    chapterSlug: "chuong-deep-learning",
    title: "Deep Learning",
    icon: "🧠",
    intro: "Mạng nơ-ron và cách chúng học.",
  },
]

// ── Notion article pages (published child Documents with real content) ──────
interface NotionArticle {
  slug: string
  chapterSlug: string
  title: string
  icon: string
  body: string
}
const notionArticles: NotionArticle[] = [
  {
    slug: "tu-duy-python",
    chapterSlug: "chuong-python",
    title: "Tư duy lập trình Python",
    icon: "💡",
    body: content(
      h(1, "Tư duy lập trình Python"),
      p(
        "Python đề cao code dễ đọc. Trước khi tối ưu tốc độ, hãy viết code rõ ràng để người khác (và chính bạn sau này) hiểu được."
      ),
      h(2, "Nguyên tắc cốt lõi"),
      li("Rõ ràng hơn thông minh: đặt tên biến có nghĩa."),
      li("Một hàm làm một việc."),
      li("Dùng cấu trúc dữ liệu sẵn có: list, dict, set, tuple."),
      h(2, "Bài thực hành liên quan"),
      p(
        'Sau khi đọc lý thuyết này, mở notebook "Python cơ bản" trong cùng chương để thực hành trực tiếp.'
      )
    ),
  },
  {
    slug: "khai-niem-dai-so",
    chapterSlug: "chuong-toan",
    title: "Khái niệm đại số tuyến tính",
    icon: "🔢",
    body: content(
      h(1, "Đại số tuyến tính cho ML"),
      p(
        "Machine Learning làm việc với vector và ma trận. Hiểu các phép toán này giúp bạn nắm được điều gì đang diễn ra bên trong mô hình."
      ),
      h(2, "Khái niệm cần nhớ"),
      li("Vector: một dãy số, biểu diễn một điểm dữ liệu (feature)."),
      li("Ma trận: một bảng số, biểu diễn cả tập dữ liệu."),
      li("Tích vô hướng (dot product): nền tảng của mọi lớp neural network."),
      p(
        "Thực hành các phép toán này trong notebook đại số tuyến tính của chương."
      )
    ),
  },
  {
    slug: "vector-hoa-hieu-nang",
    chapterSlug: "chuong-numpy-pandas",
    title: "Vector hóa & hiệu năng",
    icon: "⚡",
    body: content(
      h(1, "Vector hóa & hiệu năng"),
      p(
        "Vòng lặp Python thuần rất chậm trên dữ liệu lớn. NumPy cho phép áp dụng phép toán lên cả mảng cùng lúc — nhanh hơn hàng chục lần."
      ),
      h(2, "Vì sao nhanh hơn"),
      li("NumPy chạy phép toán ở tầng C, không qua vòng lặp Python."),
      li("Dữ liệu nằm liền nhau trong bộ nhớ → tận dụng cache CPU."),
      h(2, "Quy tắc thực hành"),
      li("Tránh vòng for trên mảng — tìm phép toán vector tương đương."),
      li("Dùng broadcasting thay vì lặp thủ công.")
    ),
  },
  {
    slug: "nguyen-tac-truc-quan",
    chapterSlug: "chuong-viz",
    title: "Nguyên tắc trực quan hóa",
    icon: "🎨",
    body: content(
      h(1, "Nguyên tắc trực quan hóa dữ liệu"),
      p("Một biểu đồ tốt trả lời một câu hỏi rõ ràng, không trang trí thừa."),
      h(2, "Chọn đúng loại biểu đồ"),
      li("Xu hướng theo thời gian → line chart."),
      li("So sánh các nhóm → bar chart."),
      li("Quan hệ giữa hai biến → scatter plot."),
      h(2, "Tránh"),
      li("Biểu đồ 3D không cần thiết."),
      li("Quá nhiều màu gây rối."),
      p("Thực hành vẽ biểu đồ trong notebook Matplotlib của chương.")
    ),
  },
  {
    slug: "overfitting-regularization",
    chapterSlug: "chuong-supervised",
    title: "Overfitting & Regularization",
    icon: "🎯",
    body: content(
      h(1, "Overfitting & Regularization"),
      p(
        "Overfitting là khi mô hình học thuộc dữ liệu huấn luyện nhưng dự đoán kém trên dữ liệu mới."
      ),
      h(2, "Dấu hiệu"),
      li("Sai số trên tập train rất thấp nhưng trên tập test lại cao."),
      h(2, "Cách khắc phục"),
      li("Thêm dữ liệu huấn luyện."),
      li("Regularization (L1/L2) để phạt trọng số quá lớn."),
      li("Giảm độ phức tạp của mô hình."),
      p("Xem hiện tượng này trực tiếp trong notebook hồi quy & phân loại.")
    ),
  },
  {
    slug: "truc-giac-backprop",
    chapterSlug: "chuong-deep-learning",
    title: "Trực giác Backpropagation",
    icon: "🔁",
    body: content(
      h(1, "Trực giác Backpropagation"),
      p(
        "Backpropagation là cách mạng nơ-ron học: lan truyền sai số ngược từ đầu ra về từng trọng số để biết cần chỉnh theo hướng nào."
      ),
      h(2, "Ba bước lặp lại"),
      li("Forward: đưa dữ liệu qua mạng, tính đầu ra."),
      li("Loss: đo sai số so với đáp án đúng."),
      li("Backward: tính gradient và cập nhật trọng số."),
      p(
        'Notebook "Mạng nơ-ron từ zero" xây lại toàn bộ quá trình này bằng NumPy thuần.'
      )
    ),
  },
]

// ── Roadmap nodes ───────────────────────────────────────────────────────────
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
  /** For notion articles: filled from the seeded child doc id at insert time. */
  notionArticleSlug?: string
}

const nodes: SeedNode[] = [
  // ── ROLE ──
  {
    id: "ds-role",
    parentId: null,
    nodeType: "role",
    title: "Data Science Engineer",
    slug: "ds-engineer",
    x: 900,
    y: 0,
    order: 0,
    description:
      "Từ Python nền tảng đến Machine Learning, kết hợp lý thuyết (Notion) và thực hành notebook (Jupyter).",
  },

  // ── SKILL 1: Python & Toán nền tảng ──
  {
    id: "ds-sk-foundation",
    parentId: "ds-role",
    nodeType: "skill",
    title: "Python & Toán nền tảng",
    slug: "ds-python-toan",
    x: 300,
    y: 180,
    order: 1,
    description: "Ngôn ngữ Python và toán cần thiết cho ML.",
  },
  {
    id: "ds-ch-python",
    parentId: "ds-sk-foundation",
    nodeType: "chapter",
    title: "Python cơ bản",
    slug: "chuong-python",
    x: 140,
    y: 360,
    order: 2,
  },
  {
    id: "ds-ar-python-nb",
    parentId: "ds-ch-python",
    nodeType: "article",
    title: "Python cơ bản (hands-on)",
    slug: "python-co-ban",
    x: 40,
    y: 540,
    order: 3,
    articleType: "jupyter",
    description: "Notebook thực hành: biến, kiểu dữ liệu, vòng lặp, hàm.",
  },
  {
    id: "ds-ar-python-doc",
    parentId: "ds-ch-python",
    nodeType: "article",
    title: "Tư duy lập trình Python",
    slug: "tu-duy-python",
    x: 240,
    y: 540,
    order: 4,
    articleType: "notion",
    notionArticleSlug: "tu-duy-python",
    description: "Tài liệu Notion: nguyên tắc viết code Python rõ ràng.",
  },
  {
    id: "ds-ch-toan",
    parentId: "ds-sk-foundation",
    nodeType: "chapter",
    title: "Toán cho ML",
    slug: "chuong-toan",
    x: 460,
    y: 360,
    order: 5,
  },
  {
    id: "ds-ar-daiso-nb",
    parentId: "ds-ch-toan",
    nodeType: "article",
    title: "Đại số tuyến tính (lab)",
    slug: "dai-so-tuyen-tinh",
    x: 380,
    y: 540,
    order: 6,
    articleType: "jupyter",
    description: "Notebook: vector, ma trận, dot product với NumPy.",
  },
  {
    id: "ds-ar-daiso-doc",
    parentId: "ds-ch-toan",
    nodeType: "article",
    title: "Khái niệm đại số tuyến tính",
    slug: "khai-niem-dai-so",
    x: 580,
    y: 540,
    order: 7,
    articleType: "notion",
    notionArticleSlug: "khai-niem-dai-so",
    description: "Tài liệu Notion: vector, ma trận và ý nghĩa trong ML.",
  },

  // ── SKILL 2: Thư viện dữ liệu ──
  {
    id: "ds-sk-libs",
    parentId: "ds-role",
    nodeType: "skill",
    title: "Thư viện dữ liệu",
    slug: "ds-thu-vien",
    x: 900,
    y: 180,
    order: 8,
    description: "NumPy, Pandas và trực quan hóa dữ liệu.",
  },
  {
    id: "ds-ch-numpy",
    parentId: "ds-sk-libs",
    nodeType: "chapter",
    title: "NumPy & Pandas",
    slug: "chuong-numpy-pandas",
    x: 760,
    y: 360,
    order: 9,
  },
  {
    id: "ds-ar-numpy-nb",
    parentId: "ds-ch-numpy",
    nodeType: "article",
    title: "NumPy cơ bản",
    slug: "numpy-co-ban",
    x: 660,
    y: 540,
    order: 10,
    articleType: "jupyter",
    description: "Notebook: mảng ndarray, slicing, broadcasting.",
  },
  {
    id: "ds-ar-pandas-nb",
    parentId: "ds-ch-numpy",
    nodeType: "article",
    title: "Pandas cơ bản",
    slug: "pandas-co-ban",
    x: 820,
    y: 540,
    order: 11,
    articleType: "jupyter",
    description: "Notebook: DataFrame, lọc, groupby.",
  },
  {
    id: "ds-ar-vector-doc",
    parentId: "ds-ch-numpy",
    nodeType: "article",
    title: "Vector hóa & hiệu năng",
    slug: "vector-hoa-hieu-nang",
    x: 740,
    y: 700,
    order: 12,
    articleType: "notion",
    notionArticleSlug: "vector-hoa-hieu-nang",
    description: "Tài liệu Notion: vì sao vector hóa nhanh hơn vòng lặp.",
  },
  {
    id: "ds-ch-viz",
    parentId: "ds-sk-libs",
    nodeType: "chapter",
    title: "Trực quan hóa",
    slug: "chuong-viz",
    x: 1040,
    y: 360,
    order: 13,
  },
  {
    id: "ds-ar-viz-nb",
    parentId: "ds-ch-viz",
    nodeType: "article",
    title: "Trực quan hóa Matplotlib",
    slug: "truc-quan-hoa-matplotlib",
    x: 980,
    y: 540,
    order: 14,
    articleType: "jupyter",
    description: "Notebook: line, scatter, bar chart với Matplotlib.",
  },
  {
    id: "ds-ar-viz-doc",
    parentId: "ds-ch-viz",
    nodeType: "article",
    title: "Nguyên tắc trực quan hóa",
    slug: "nguyen-tac-truc-quan",
    x: 1180,
    y: 540,
    order: 15,
    articleType: "notion",
    notionArticleSlug: "nguyen-tac-truc-quan",
    description: "Tài liệu Notion: chọn đúng loại biểu đồ.",
  },

  // ── SKILL 3: Machine Learning ──
  {
    id: "ds-sk-ml",
    parentId: "ds-role",
    nodeType: "skill",
    title: "Machine Learning",
    slug: "ds-ml",
    x: 1500,
    y: 180,
    order: 16,
    description: "Học có giám sát và deep learning.",
  },
  {
    id: "ds-ch-supervised",
    parentId: "ds-sk-ml",
    nodeType: "chapter",
    title: "Học có giám sát",
    slug: "chuong-supervised",
    x: 1360,
    y: 360,
    order: 17,
  },
  {
    id: "ds-ar-hoiquy-nb",
    parentId: "ds-ch-supervised",
    nodeType: "article",
    title: "Hồi quy tuyến tính",
    slug: "hoi-quy-tuyen-tinh",
    x: 1260,
    y: 540,
    order: 18,
    articleType: "jupyter",
    description: "Notebook: dựng mô hình hồi quy tuyến tính từ đầu.",
  },
  {
    id: "ds-ar-sklearn-nb",
    parentId: "ds-ch-supervised",
    nodeType: "article",
    title: "Phân loại với scikit-learn",
    slug: "phan-loai-sklearn",
    x: 1420,
    y: 540,
    order: 19,
    articleType: "jupyter",
    description: "Notebook: train/test split và phân loại với sklearn.",
  },
  {
    id: "ds-ar-overfit-doc",
    parentId: "ds-ch-supervised",
    nodeType: "article",
    title: "Overfitting & Regularization",
    slug: "overfitting-regularization",
    x: 1340,
    y: 700,
    order: 20,
    articleType: "notion",
    notionArticleSlug: "overfitting-regularization",
    description: "Tài liệu Notion: nhận biết và khắc phục overfitting.",
  },
  {
    id: "ds-ch-dl",
    parentId: "ds-sk-ml",
    nodeType: "chapter",
    title: "Deep Learning",
    slug: "chuong-deep-learning",
    x: 1640,
    y: 360,
    order: 21,
  },
  {
    id: "ds-ar-nn-nb",
    parentId: "ds-ch-dl",
    nodeType: "article",
    title: "Mạng nơ-ron từ zero",
    slug: "mang-no-ron-tu-zero",
    x: 1560,
    y: 540,
    order: 22,
    articleType: "jupyter",
    description: "Notebook: xây mạng nơ-ron bằng NumPy thuần.",
  },
  {
    id: "ds-ar-backprop-doc",
    parentId: "ds-ch-dl",
    nodeType: "article",
    title: "Trực giác Backpropagation",
    slug: "truc-giac-backprop",
    x: 1760,
    y: 540,
    order: 23,
    articleType: "notion",
    notionArticleSlug: "truc-giac-backprop",
    description: "Tài liệu Notion: mạng nơ-ron học như thế nào.",
  },
]

const AUTHOR_ID = "seed-admin"

async function main() {
  // 1. Roadmap
  await prisma.roadmap.upsert({
    where: { id: ROADMAP.id },
    create: ROADMAP,
    update: ROADMAP,
  })

  // 2. Notion Documents — reset this roadmap's docs by id, then re-create so
  //    the published tree is deterministic on every run. Ids are stable.
  const rootIdOf = (chapterSlug: string) => `doc-${chapterSlug}`
  const childIdOf = (articleSlug: string) => `doc-art-${articleSlug}`

  const docIds = [
    ...notionRoots.map((r) => rootIdOf(r.chapterSlug)),
    ...notionArticles.map((a) => childIdOf(a.slug)),
  ]
  await prisma.document.deleteMany({ where: { id: { in: docIds } } })

  for (const root of notionRoots) {
    await prisma.document.create({
      data: {
        id: rootIdOf(root.chapterSlug),
        slug: root.chapterSlug,
        title: root.title,
        icon: root.icon,
        authorId: AUTHOR_ID,
        isPublished: true,
        content: content(h(1, root.title), p(root.intro)),
        position: 0,
      },
    })
  }

  // Child article pages, nested under their chapter root, published w/ content.
  const notionPageIdBySlug = new Map<string, string>()
  for (const [index, art] of notionArticles.entries()) {
    const id = childIdOf(art.slug)
    await prisma.document.create({
      data: {
        id,
        slug: art.slug,
        title: art.title,
        icon: art.icon,
        authorId: AUTHOR_ID,
        parentDocumentId: rootIdOf(art.chapterSlug),
        isPublished: true,
        content: art.body,
        position: index,
      },
    })
    notionPageIdBySlug.set(art.slug, id)
  }

  // 3. Nodes (parent-before-child order preserved by the array).
  await prisma.node.deleteMany({
    where: {
      slug: { in: nodes.map((n) => n.slug) },
      id: { notIn: nodes.map((n) => n.id) },
    },
  })

  for (const n of nodes) {
    const notionPageId = n.notionArticleSlug
      ? (notionPageIdBySlug.get(n.notionArticleSlug) ?? null)
      : null
    const data = {
      roadmapId: ROADMAP.id,
      parentId: n.parentId,
      title: n.title,
      slug: n.slug,
      description: n.description ?? null,
      nodeType: n.nodeType,
      articleType: n.articleType ?? null,
      notionPageId,
      positionX: n.x,
      positionY: n.y,
      order: n.order,
      isDeleted: false,
      isPublished: n.articleType === "notion" ? true : false,
    }
    await prisma.node.upsert({
      where: { id: n.id },
      create: { id: n.id, ...data },
      update: data,
    })
  }

  console.log(
    `Seeded roadmap "${ROADMAP.title}": ${nodes.length} nodes, ` +
      `${notionRoots.length} notion roots + ${notionArticles.length} notion pages.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
