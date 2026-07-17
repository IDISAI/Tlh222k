// Mock Notion content keyed by notionPageId. Each doc covers every supported
// block type (heading_1/2/3, paragraph, bulleted + numbered list, code, image)
// so the drawer renderer exercises Property 14. ponytail: replace with svc-notion.

function makeDoc(
  title: string,
  opts: { intro: string; lang: string; code: string }
): string {
  return [
    `# ${title}`,
    "",
    opts.intro,
    "",
    "## Vì sao quan trọng",
    "",
    "- Là nền tảng cho các chủ đề nâng cao",
    "- Được sử dụng rộng rãi trong thực tế",
    "- Thường xuất hiện trong phỏng vấn",
    "",
    "## Lộ trình học",
    "",
    "1. Nắm khái niệm cốt lõi",
    "2. Thực hành qua ví dụ nhỏ",
    "3. Xây dựng một dự án hoàn chỉnh",
    "",
    "### Ví dụ mã",
    "",
    "```" + opts.lang,
    opts.code,
    "```",
    "",
    `![Minh hoạ ${title}](https://placehold.co/600x300/6366f1/ffffff?text=${encodeURIComponent(
      title
    )})`,
    "",
  ].join("\n")
}

export const MOCK_NOTION: Record<string, string> = {
  "notion-internet": makeDoc("Internet", {
    intro: "Internet là mạng lưới toàn cầu kết nối hàng tỉ thiết bị qua giao thức chung.",
    lang: "text",
    code: "GET / HTTP/1.1\nHost: example.com",
  }),
  "notion-html": makeDoc("HTML", {
    intro: "HTML (HyperText Markup Language) định nghĩa cấu trúc và nội dung của trang web.",
    lang: "html",
    code: '<h1>Hello</h1>\n<p>Xin chào thế giới</p>',
  }),
  "notion-css": makeDoc("CSS", {
    intro: "CSS (Cascading Style Sheets) mô tả cách trình bày và bố cục của HTML.",
    lang: "css",
    code: ".btn {\n  color: white;\n  background: indigo;\n}",
  }),
  "notion-javascript": makeDoc("JavaScript", {
    intro: "JavaScript là ngôn ngữ lập trình cho phép tạo tương tác động trên trang web.",
    lang: "js",
    code: "const sum = (a, b) => a + b\nconsole.log(sum(2, 3))",
  }),
  "notion-react": makeDoc("React", {
    intro: "React là thư viện xây dựng giao diện theo mô hình component.",
    lang: "tsx",
    code: "function App() {\n  return <h1>Hi</h1>\n}",
  }),
  "notion-a11y": makeDoc("Accessibility", {
    intro: "Accessibility đảm bảo mọi người, kể cả người khuyết tật, dùng được sản phẩm.",
    lang: "html",
    code: '<button aria-label="Đóng">×</button>',
  }),
  "notion-nodejs": makeDoc("Node.js", {
    intro: "Node.js là môi trường chạy JavaScript phía máy chủ dựa trên V8.",
    lang: "js",
    code: "import http from 'node:http'\nhttp.createServer().listen(3000)",
  }),
  "notion-databases": makeDoc("Databases", {
    intro: "Cơ sở dữ liệu lưu trữ và truy vấn dữ liệu có cấu trúc hoặc phi cấu trúc.",
    lang: "sql",
    code: "SELECT id, title FROM roadmaps WHERE is_published = true;",
  }),
  "notion-apis": makeDoc("APIs", {
    intro: "API là hợp đồng cho phép các hệ thống trao đổi dữ liệu với nhau.",
    lang: "graphql",
    code: "query {\n  roadmaps { id title }\n}",
  }),
  "notion-auth": makeDoc("Authentication", {
    intro: "Xác thực xác minh danh tính người dùng; phân quyền quyết định quyền truy cập.",
    lang: "ts",
    code: "const { userId } = await auth()",
  }),
  "notion-linux": makeDoc("Linux", {
    intro: "Linux là hệ điều hành mã nguồn mở phổ biến cho máy chủ.",
    lang: "bash",
    code: "ls -la /var/www",
  }),
  "notion-docker": makeDoc("Docker", {
    intro: "Docker đóng gói ứng dụng và phụ thuộc vào các container di động.",
    lang: "dockerfile",
    code: "FROM node:20\nCMD [\"node\", \"server.js\"]",
  }),
  "notion-cicd": makeDoc("CI/CD", {
    intro: "CI/CD tự động hoá kiểm thử và triển khai để phát hành nhanh và an toàn.",
    lang: "yaml",
    code: "steps:\n  - run: pnpm build",
  }),
  "notion-k8s": makeDoc("Kubernetes", {
    intro: "Kubernetes điều phối container ở quy mô lớn với khả năng tự phục hồi.",
    lang: "bash",
    code: "kubectl get pods",
  }),
}
