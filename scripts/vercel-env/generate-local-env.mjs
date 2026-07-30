#!/usr/bin/env node
// Ghi lại các file .env.local / .env cho từng app từ scripts/vercel-env/manifest.json
// (mục "local"). Dùng khi setup máy mới, hoặc lỡ tay xoá mất file .env.local.
//
// Cách dùng:
//   node scripts/vercel-env/generate-local-env.mjs             # chỉ tạo file CHƯA có (an toàn)
//   node scripts/vercel-env/generate-local-env.mjs --force      # ghi đè cả file đã có
//   node scripts/vercel-env/generate-local-env.mjs web --force  # chỉ app chỉ định
//
// Mặc định KHÔNG đè file .env.local/.env đã có sẵn — máy đang dùng có thể đã
// chỉnh tay (thêm comment, đổi giá trị) và ghi đè vô điều kiện sẽ mất hết.
// Chỉ dùng --force khi cố ý muốn reset về đúng nội dung trong manifest.json.
//
// manifest.json bị gitignore (chứa giá trị thật, dù chỉ là test/dev key —
// không phải secret production thật) — mỗi máy dev cần file này tồn tại sẵn
// (đồng nghiệp gửi qua kênh riêng, KHÔNG qua git) trước khi chạy script.

import { writeFileSync, existsSync } from "node:fs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "../..")
const manifestPath = join(__dirname, "manifest.json")

if (!existsSync(manifestPath)) {
  console.error(
    "Không thấy scripts/vercel-env/manifest.json — file này bị gitignore, cần xin đồng nghiệp gửi riêng (không qua git) rồi đặt vào đúng vị trí trước khi chạy script."
  )
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const args = process.argv.slice(2)
const force = args.includes("--force")
const only = args.filter((a) => a !== "--force")

for (const entry of manifest.local ?? []) {
  if (only.length > 0 && !only.includes(entry.app)) continue

  const targetPath = join(repoRoot, entry.file)
  if (existsSync(targetPath) && !force) {
    console.log(`  skip  ${entry.file} đã tồn tại (dùng --force nếu muốn ghi đè)`)
    continue
  }

  const lines = [
    `# Auto-generated bởi scripts/vercel-env/generate-local-env.mjs`,
    `# Nguồn: scripts/vercel-env/manifest.json (mục "local" -> "${entry.app}")`,
    `# Xem apps/${entry.app === "db" ? "../packages/db" : entry.app}/.env.example để hiểu rõ từng biến — file này chỉ có giá trị, không có giải thích.`,
    "",
    ...Object.entries(entry.vars).map(([key, value]) => `${key}=${value}`),
    "",
  ]

  writeFileSync(targetPath, lines.join("\n"), "utf8")
  console.log(`  wrote ${entry.file} (${Object.keys(entry.vars).length} biến)`)
}

console.log("\nXong. Không đụng tới scripts/vercel-env/manifest.json khi commit — file đó bị gitignore.")
