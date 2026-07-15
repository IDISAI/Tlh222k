import { PrismaClient } from "@prisma/client"

// "AI Engineer từ Zero" roadmap. Idempotent (upsert by id) so it can run on a
// live DB without touching other roadmaps: `pnpm -F @workspace/db seed:ai`.
// Every article is an INTERNAL jupyter notebook (articleType "jupyter", no
// jupyterUrl) → web opens /learn/[slug]; the notebook with the same slug lives
// on kernel-server.

const prisma = new PrismaClient()

const roadmap = {
  id: "rm-ai-tu-zero",
  slug: "ai-tu-zero",
  title: "AI Engineer từ Zero",
  description:
    "Lộ trình AI từ con số 0: Python, toán nền tảng, machine learning và mạng nơ-ron — mỗi bài là một Jupyter notebook chạy trực tiếp trên trình duyệt.",
  thumbnailUrl: "https://placehold.co/600x338/8b5cf6/ffffff?text=AI+t%E1%BB%AB+Zero",
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
  { id: "ai0-role", parentId: null, nodeType: "role", title: "AI Engineer từ Zero", slug: "ai-engineer-tu-zero", x: 560, y: 0, order: 0, description: "Từ chưa biết lập trình đến tự xây mô hình machine learning: Python → toán → ML → mạng nơ-ron." },

  { id: "ai0-sk-python", parentId: "ai0-role", nodeType: "skill", title: "Python", slug: "ai0-python", x: 180, y: 160, order: 1, description: "Ngôn ngữ tiêu chuẩn của AI — cú pháp, cấu trúc dữ liệu và thư viện khoa học dữ liệu." },
  { id: "ai0-ch-python", parentId: "ai0-sk-python", nodeType: "chapter", title: "Python nền tảng", slug: "ai0-python-nen-tang", x: 60, y: 320, order: 2, description: "Biến, kiểu dữ liệu, điều khiển luồng, hàm và NumPy." },
  { id: "ai0-ar-python", parentId: "ai0-ch-python", nodeType: "article", title: "Python cơ bản", slug: "python-co-ban", x: 60, y: 480, order: 3, articleType: "jupyter", description: "Notebook: biến, kiểu dữ liệu, if/for, hàm — chạy thử ngay trên trình duyệt." },
  { id: "ai0-ar-numpy", parentId: "ai0-ch-python", nodeType: "article", title: "NumPy cơ bản", slug: "numpy-co-ban", x: 60, y: 620, order: 4, articleType: "jupyter", description: "Notebook: mảng NumPy, vectorization và broadcasting." },
  { id: "ai0-ch-data", parentId: "ai0-sk-python", nodeType: "chapter", title: "Dữ liệu & trực quan hóa", slug: "ai0-du-lieu", x: 320, y: 320, order: 5, description: "Pandas DataFrame và vẽ biểu đồ với Matplotlib." },
  { id: "ai0-ar-pandas", parentId: "ai0-ch-data", nodeType: "article", title: "Pandas cơ bản", slug: "pandas-co-ban", x: 320, y: 480, order: 6, articleType: "jupyter", description: "Notebook: DataFrame, lọc, groupby và thống kê mô tả." },
  { id: "ai0-ar-matplotlib", parentId: "ai0-ch-data", nodeType: "article", title: "Trực quan hóa với Matplotlib", slug: "truc-quan-hoa-matplotlib", x: 320, y: 620, order: 7, articleType: "jupyter", description: "Notebook: line/scatter/histogram — nhìn thấy dữ liệu trước khi mô hình hóa." },

  { id: "ai0-sk-math", parentId: "ai0-role", nodeType: "skill", title: "Toán cho AI", slug: "ai0-toan", x: 560, y: 160, order: 8, description: "Đại số tuyến tính và thống kê — ngôn ngữ của machine learning." },
  { id: "ai0-ch-math", parentId: "ai0-sk-math", nodeType: "chapter", title: "Đại số & thống kê", slug: "ai0-dai-so-thong-ke", x: 560, y: 320, order: 9, description: "Vector, ma trận, phân phối và tương quan." },
  { id: "ai0-ar-linalg", parentId: "ai0-ch-math", nodeType: "article", title: "Đại số tuyến tính", slug: "dai-so-tuyen-tinh", x: 560, y: 480, order: 10, articleType: "jupyter", description: "Notebook: vector, ma trận, tích vô hướng — bằng NumPy thay vì bảng đen." },

  { id: "ai0-sk-ml", parentId: "ai0-role", nodeType: "skill", title: "Machine Learning", slug: "ai0-ml", x: 830, y: 160, order: 11, description: "Học từ dữ liệu: hồi quy, phân loại, đánh giá mô hình." },
  { id: "ai0-ch-ml", parentId: "ai0-sk-ml", nodeType: "chapter", title: "ML cơ bản", slug: "ai0-ml-co-ban", x: 830, y: 320, order: 12, description: "Hồi quy tuyến tính tự cài đặt và phân loại với scikit-learn." },
  { id: "ai0-ar-regression", parentId: "ai0-ch-ml", nodeType: "article", title: "Hồi quy tuyến tính từ zero", slug: "hoi-quy-tuyen-tinh", x: 830, y: 480, order: 13, articleType: "jupyter", description: "Notebook: tự cài gradient descent, không dùng thư viện ML." },
  { id: "ai0-ar-sklearn", parentId: "ai0-ch-ml", nodeType: "article", title: "Phân loại với scikit-learn", slug: "phan-loai-sklearn", x: 830, y: 620, order: 14, articleType: "jupyter", description: "Notebook: train/test split, logistic regression, accuracy trên bộ Iris." },

  { id: "ai0-sk-dl", parentId: "ai0-role", nodeType: "skill", title: "Deep Learning", slug: "ai0-dl", x: 1090, y: 160, order: 15, description: "Mạng nơ-ron — nền tảng của AI hiện đại." },
  { id: "ai0-ch-dl", parentId: "ai0-sk-dl", nodeType: "chapter", title: "Mạng nơ-ron", slug: "ai0-mang-no-ron", x: 1090, y: 320, order: 16, description: "Perceptron, hàm kích hoạt, backpropagation." },
  { id: "ai0-ar-nn", parentId: "ai0-ch-dl", nodeType: "article", title: "Mạng nơ-ron từ zero", slug: "mang-no-ron-tu-zero", x: 1090, y: 480, order: 17, articleType: "jupyter", description: "Notebook: cài mạng 2 lớp bằng NumPy, học hàm XOR." },
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
  console.log(`Seeded roadmap ${roadmap.slug} with ${nodes.length} nodes`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
