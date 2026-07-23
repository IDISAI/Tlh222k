import { PrismaClient } from "@prisma/client"

// Public catalogue seed: discovery labels + ~18 published role blocks with real
// Vietnamese titles and descriptions.
//
// Why this exists: the catalogue was three blocks titled "A1", "A11" and
// "Data Engineer" with NO descriptions. You cannot evaluate search — keyword or
// semantic — against that, because there is nothing to match on. This gives the
// search work a corpus with actual meaning in it.
//
// The content is chosen to exercise the queries search has to answer:
//   "học toán"            -> Giải tích / Đại số tuyến tính / Xác suất
//   "ngoại ngữ"           -> Tiếng Anh / Nhật / Trung / Hàn
//   "ngôn ngữ lập trình"  -> Python / C++ / JavaScript / Go
//   "đã biết Python..."   -> Machine Learning / Data Engineer / Backend
// Note that NONE of those four queries share a literal word with the titles
// they should return — that gap is exactly what the search work has to close.
//
// Idempotent (upsert by fixed id) so it is safe to re-run on a live dev DB and
// never touches roadmaps it did not create:
//   pnpm -F @workspace/db seed:catalog

const prisma = new PrismaClient()

interface SeedField {
  id: string
  name: string
  slug: string
  order: number
}

const fields: SeedField[] = [
  { id: "fld-toan-hoc", name: "Toán học", slug: "toan-hoc", order: 0 },
  { id: "fld-ngoai-ngu", name: "Ngoại ngữ", slug: "ngoai-ngu", order: 1 },
  { id: "fld-lap-trinh", name: "Lập trình", slug: "lap-trinh", order: 2 },
  { id: "fld-web", name: "Web Development", slug: "web-development", order: 3 },
  { id: "fld-ai-data", name: "AI & Dữ liệu", slug: "ai-du-lieu", order: 4 },
  { id: "fld-thiet-ke", name: "Thiết kế", slug: "thiet-ke", order: 5 },
]

interface SeedBlock {
  id: string
  slug: string
  title: string
  description: string
  /** Labels this block carries. Many on purpose — see "Đại số tuyến tính". */
  fieldIds: string[]
}

const blocks: SeedBlock[] = [
  // ── Toán học ──────────────────────────────────────────────────────────────
  {
    id: "cat-giai-tich",
    slug: "giai-tich",
    title: "Giải tích",
    description:
      "Giới hạn, đạo hàm, tích phân và chuỗi. Nền tảng toán cao cấp cho kỹ thuật, kinh tế và machine learning — học để hiểu tại sao gradient descent hoạt động, không chỉ để thi.",
    fieldIds: ["fld-toan-hoc"],
  },
  {
    id: "cat-dai-so-tuyen-tinh",
    slug: "dai-so-tuyen-tinh-roadmap",
    title: "Đại số tuyến tính",
    description:
      "Vector, ma trận, không gian vector, trị riêng và vector riêng. Đây là ngôn ngữ của học máy: mọi mô hình từ hồi quy đến mạng nơ-ron đều là phép biến đổi tuyến tính lồng nhau.",
    fieldIds: ["fld-toan-hoc", "fld-ai-data"],
  },
  {
    id: "cat-xac-suat-thong-ke",
    slug: "xac-suat-thong-ke",
    title: "Xác suất & Thống kê",
    description:
      "Biến ngẫu nhiên, phân phối, kiểm định giả thuyết và suy luận Bayes. Cần thiết để đọc kết quả mô hình, thiết kế A/B test và không bị số liệu đánh lừa.",
    fieldIds: ["fld-toan-hoc", "fld-ai-data"],
  },
  {
    id: "cat-toan-roi-rac",
    slug: "toan-roi-rac",
    title: "Toán rời rạc",
    description:
      "Logic mệnh đề, tập hợp, tổ hợp, đồ thị và quy nạp. Nền toán của khoa học máy tính — nằm dưới mọi thuật toán, cấu trúc dữ liệu và bài toán tối ưu.",
    fieldIds: ["fld-toan-hoc", "fld-lap-trinh"],
  },

  // ── Ngoại ngữ ─────────────────────────────────────────────────────────────
  {
    id: "cat-tieng-anh",
    slug: "tieng-anh-giao-tiep",
    title: "Tiếng Anh giao tiếp",
    description:
      "Từ mất gốc đến nói trôi chảy trong môi trường công sở: phát âm, nghe hiểu, phản xạ hội thoại và viết email. Kèm lộ trình luyện IELTS cho người cần chứng chỉ.",
    fieldIds: ["fld-ngoai-ngu"],
  },
  {
    id: "cat-tieng-nhat",
    slug: "tieng-nhat-n5-n3",
    title: "Tiếng Nhật N5 → N3",
    description:
      "Hiragana, Katakana, 1000 chữ Kanji thông dụng và ngữ pháp JLPT từ N5 lên N3. Hướng tới làm việc tại công ty Nhật hoặc du học.",
    fieldIds: ["fld-ngoai-ngu"],
  },
  {
    id: "cat-tieng-trung",
    slug: "tieng-trung-hsk",
    title: "Tiếng Trung HSK 1-4",
    description:
      "Pinyin, thanh điệu, chữ Hán giản thể và 1200 từ vựng theo khung HSK. Trọng tâm giao tiếp thương mại và đọc hiểu văn bản đời thường.",
    fieldIds: ["fld-ngoai-ngu"],
  },
  {
    id: "cat-tieng-han",
    slug: "tieng-han-topik",
    title: "Tiếng Hàn TOPIK I",
    description:
      "Bảng chữ Hangul, quy tắc phát âm, kính ngữ và ngữ pháp cơ bản tới trình độ TOPIK cấp 2. Phù hợp người bắt đầu từ con số không.",
    fieldIds: ["fld-ngoai-ngu"],
  },

  // ── Lập trình ─────────────────────────────────────────────────────────────
  {
    id: "cat-python",
    slug: "python-co-ban",
    title: "Python",
    description:
      "Cú pháp, kiểu dữ liệu, hàm, OOP và thư viện chuẩn. Ngôn ngữ dễ vào nhất cho người mới, đồng thời là lựa chọn số một cho khoa học dữ liệu và tự động hóa.",
    fieldIds: ["fld-lap-trinh", "fld-ai-data"],
  },
  {
    id: "cat-cpp",
    slug: "cpp-tu-co-ban",
    title: "C++",
    description:
      "Con trỏ, quản lý bộ nhớ thủ công, STL và lập trình hướng đối tượng. Dùng cho hệ thống hiệu năng cao, game engine và thi lập trình thuật toán.",
    fieldIds: ["fld-lap-trinh"],
  },
  {
    id: "cat-javascript",
    slug: "javascript-hien-dai",
    title: "JavaScript",
    description:
      "Ngôn ngữ chạy trong mọi trình duyệt: closure, bất đồng bộ, ES modules và TypeScript. Cửa vào của lập trình web ở cả phía giao diện lẫn máy chủ.",
    fieldIds: ["fld-lap-trinh", "fld-web"],
  },
  {
    id: "cat-go",
    slug: "go-backend",
    title: "Go",
    description:
      "Cú pháp tối giản, goroutine và channel cho lập trình đồng thời. Được chọn cho dịch vụ backend cần chịu tải cao với chi phí vận hành thấp.",
    fieldIds: ["fld-lap-trinh", "fld-web"],
  },

  // ── AI & Dữ liệu (đích đến sau khi đã biết Python) ────────────────────────
  {
    id: "cat-machine-learning",
    slug: "machine-learning",
    title: "Machine Learning",
    description:
      "Bước tiếp theo sau khi đã vững Python: hồi quy, phân loại, cây quyết định, đánh giá mô hình và tránh overfitting. Cần nền đại số tuyến tính và xác suất.",
    fieldIds: ["fld-ai-data"],
  },
  {
    id: "cat-data-engineer",
    slug: "data-engineer",
    title: "Data Engineer",
    description:
      "Xây đường ống dữ liệu: SQL nâng cao, ETL, kho dữ liệu, Airflow và Spark. Hướng đi tự nhiên cho người đã biết Python và muốn làm việc với dữ liệu quy mô lớn.",
    fieldIds: ["fld-ai-data", "fld-lap-trinh"],
  },
  {
    id: "cat-data-analyst",
    slug: "data-analyst",
    title: "Data Analyst",
    description:
      "Đọc dữ liệu ra quyết định: SQL, Excel nâng cao, trực quan hóa với Power BI và kể chuyện bằng số liệu. Ít code hơn Data Engineer, nặng về nghiệp vụ.",
    fieldIds: ["fld-ai-data"],
  },

  // ── Web Development ───────────────────────────────────────────────────────
  {
    id: "cat-frontend",
    slug: "frontend-developer",
    title: "Frontend Developer",
    description:
      "HTML, CSS, JavaScript rồi React và Next.js. Học dựng giao diện chạy được thật: responsive, accessibility và tối ưu tốc độ tải.",
    fieldIds: ["fld-web"],
  },
  {
    id: "cat-backend",
    slug: "backend-developer",
    title: "Backend Developer",
    description:
      "API, cơ sở dữ liệu quan hệ, xác thực, caching và triển khai. Lộ trình phù hợp cho người đã biết một ngôn ngữ như Python hoặc JavaScript và muốn làm phía máy chủ.",
    fieldIds: ["fld-web", "fld-lap-trinh"],
  },
  {
    id: "cat-fullstack",
    slug: "fullstack-developer",
    title: "Fullstack Developer",
    description:
      "Gộp cả frontend và backend: dựng sản phẩm từ giao diện tới cơ sở dữ liệu và đưa lên môi trường thật. Dành cho người muốn tự làm trọn một ứng dụng.",
    fieldIds: ["fld-web"],
  },

  // ── Thiết kế ──────────────────────────────────────────────────────────────
  {
    id: "cat-ui-ux",
    slug: "ui-ux-designer",
    title: "UI/UX Designer",
    description:
      "Nghiên cứu người dùng, wireframe, hệ thống thiết kế và dựng mẫu tương tác bằng Figma. Học cách bảo vệ quyết định thiết kế bằng lý do, không bằng cảm tính.",
    fieldIds: ["fld-thiet-ke"],
  },
]

async function main() {
  // `Node.slug` is globally unique. If an unrelated row already owns one of our
  // slugs, skip that entry loudly rather than crashing the whole seed or
  // silently deleting someone else's roadmap.
  const squatters = await prisma.node.findMany({
    where: {
      slug: { in: blocks.map((b) => b.slug) },
      id: { notIn: blocks.map((b) => b.id) },
    },
    select: { id: true, slug: true, title: true },
  })
  const takenSlugs = new Set(squatters.map((s) => s.slug))
  for (const s of squatters) {
    console.warn(
      `SKIP "${s.slug}": slug already owned by node ${s.id} ("${s.title}"). ` +
        `Delete or rename that roadmap, then re-run.`
    )
  }

  for (const f of fields) {
    const data = { name: f.name, slug: f.slug, order: f.order }
    await prisma.field.upsert({
      where: { id: f.id },
      create: { id: f.id, ...data },
      update: data,
    })
  }

  let seeded = 0
  for (const b of blocks) {
    if (takenSlugs.has(b.slug)) continue
    // Each catalogue entry is its own container Roadmap plus one published role
    // node — the shape `RoadmapApi.createBlock` produces from the admin table,
    // so seeded rows behave identically to hand-created ones.
    const roadmapId = `rm-${b.id}`
    const roadmap = {
      // The container's slug is never user-facing — cards link by NODE id — so
      // it is derived from the seed id. Using the human slug here made the seed
      // collide with unrelated rows that happened to pick the same title.
      slug: roadmapId,
      title: b.title,
      description: b.description,
      thumbnailUrl: null,
      isPublished: true,
    }
    await prisma.roadmap.upsert({
      where: { id: roadmapId },
      create: { id: roadmapId, ...roadmap },
      update: roadmap,
    })

    const node = {
      roadmapId,
      parentId: null,
      title: b.title,
      slug: b.slug,
      description: b.description,
      nodeType: "role",
      positionX: 0,
      positionY: 0,
      order: 0,
      isDeleted: false,
      isPublished: true,
    }
    const labels = b.fieldIds.map((id) => ({ id }))
    await prisma.node.upsert({
      where: { id: b.id },
      // On create the row has no labels yet, so `connect` is the only valid
      // op; `set` exists solely on update, where it must REPLACE rather than
      // add so re-running the seed can't accumulate duplicates.
      create: { id: b.id, ...node, fields: { connect: labels } },
      update: { ...node, fields: { set: labels } },
    })
    seeded++
  }

  console.log(
    `Seeded ${fields.length} fields and ${seeded}/${blocks.length} published roadmaps` +
      (squatters.length ? ` (${squatters.length} skipped — see warnings)` : "")
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
