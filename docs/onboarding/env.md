# Thiết lập biến môi trường (.env)

## Nguyên tắc

- Mọi file `.env*` **đã bị gitignore** ([.gitignore](../../.gitignore) dòng `.env*`) → **không bao giờ commit**. Secret sống ở máy local và ở dashboard hosting, không nằm trong repo.
- Mỗi app/đơn vị có file `.env` riêng — không có một file `.env` gốc được load chung. [`.env.example`](../../.env.example) ở gốc chỉ là **tài liệu tổng hợp**, không được load.
- Next.js app load `.env.local` (ưu tiên cao, cho secret local). Xem thứ tự: `.env.local` > `.env.development` > `.env`.

## Thực tế hiện tại (quan trọng)

Code app **hiện chưa dùng biến môi trường nào** — chưa cài Clerk/Uploadthing, chưa gọi API. `web`, `admin`, `super-admin` chạy `dev`/`build` được **không cần bất kỳ `.env` nào**.

Các `.env.example` (Clerk, Uploadthing, `DATABASE_URL`, `api-gateway`…) mô tả **kiến trúc mục tiêu** chưa xây (xem [architecture.md](./architecture.md)). Chỉ tạo `.env.local` khi bạn thật sự thêm feature dùng tới chúng.

## Khi cần dùng: tạo `.env.local` cho từng app

```bash
cp apps/web/.env.example   apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
# super-admin: chưa có .env.example — tạo khi cần
```

Các biến và nơi lấy:

| Biến | Dùng ở | Lấy từ đâu |
|------|--------|-----------|
| `NEXT_PUBLIC_API_URL` | web, admin | URL của api-gateway (mặc định `http://localhost:3000`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | auth | clerk.com → tạo application → API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `..._AFTER_SIGN_IN_URL` | auth | đường dẫn nội bộ (`/login`, `/roadmaps`) |
| `UPLOADTHING_TOKEN` | admin (upload) | uploadthing.com → dashboard → app → API token |
| `DATABASE_URL` | packages/db | Postgres, vd `postgresql://user:pass@localhost:5432/db` (khớp [docker-compose.yml](../../docker-compose.yml)) |

`NEXT_PUBLIC_*` = lộ ra client (bundle), không đặt secret vào đó. Biến không có prefix chỉ chạy phía server.

## Trên Vercel (production/preview)

**Không upload file `.env`.** Đặt biến trong Vercel:

```bash
vercel env add NEXT_PUBLIC_API_URL production   # hoặc preview / development
vercel env pull apps/web/.env.local             # kéo về local để dev
```

Hoặc Dashboard → project → Settings → Environment Variables. `VERCEL_OIDC_TOKEN` trong `apps/admin/.env` là do `vercel` CLI tự sinh khi link project — không cần tự set.

## Bảo mật

- `.env.local` đang chứa **secret thật** (Clerk secret key, Uploadthing token). Chúng được gitignore nên an toàn khỏi repo, nhưng nếu từng bị chia sẻ/lộ (chat, screenshot, commit nhầm) hãy **rotate ngay** ở Clerk/Uploadthing dashboard.
- Không dán secret vào `.env.example` — file này được track ý niệm (dùng placeholder `sk_test_...`).

## Liên quan

- [CI/CD](./cicd.md) — GitHub Secrets cho deploy (khác với `.env` của app) · [Kiến trúc](./architecture.md)
