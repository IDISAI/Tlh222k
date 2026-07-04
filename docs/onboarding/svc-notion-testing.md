# Notion clone — Hướng dẫn kiểm tra thủ công (toàn bộ tính năng)

Kiến trúc: **GraphQL là đường data thật duy nhất** (`apps/svc-notion`, Apollo Server, Clean Architecture 4 layers) · REST/Swagger chỉ là **contract trả mock** · frontend `packages/core/src/notion` (Apollo Client + typed documents từ codegen) mount trong `apps/admin`.

## 0. Chuẩn bị

```bash
pnpm install
pnpm --filter @workspace/db db:push        # sync schema vào Postgres (schema "notion")
# env: apps/admin/.env.local + apps/svc-notion/.env — xem .env.example
# (AUTH_SECRET phải GIỐNG NHAU ở cả hai; LIVEBLOCKS_SECRET_KEY + UPLOADTHING_TOKEN trong admin)
pnpm --filter svc-notion dev               # terminal 1 — :3004
pnpm --filter admin dev                    # terminal 2 — :3002
```

Sanity: `http://localhost:3004/` trả JSON mô tả service.

## 1. Auth

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Mở `http://localhost:3002/admin` khi chưa đăng nhập | Redirect 307 → `/admin/login` |
| 2 | Vào `/admin/register`, tạo tài khoản (email + mật khẩu ≥ 8 ký tự) | Tự đăng nhập, về `/admin`, header hiện tên + nút Đăng xuất |
| 3 | Workspace | "My Workspace" tự tạo lần đầu; user mới KHÔNG thấy pages của user khác |
| 4 | `curl -X POST :3004/graphql` query `workspaces` không cookie | Lỗi `UNAUTHENTICATED` |

## 2. Pages & Editor (BlockNote + realtime)

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 5 | `+` cạnh PAGES → page mới | Page hiện trong tree, editor mở, avatar presence của bạn hiện cạnh editor |
| 6 | Gõ title + nội dung; đợi ~1s | "Đang lưu…" → "Đã lưu"; F5 nội dung còn nguyên |
| 7 | Gõ `/` trong editor | Slash menu BlockNote (heading, todo, code…) |
| 8 | Mở tab thứ 2 cùng page, gõ ở tab 1 | Tab 2 thấy text NGAY không reload; badge "2 người đang xem" |
| 9 | Hover page trong tree: `+` / ⭐ / 🗑 | Sub-page / Favorites section / vào Trash (mở Trash → Restore quay lại) |
| 10 | `Ctrl/⌘ + K` | Command palette; gõ từ khoá → kết quả sau ~300ms; Enter mở page |
| 11 | Nút mặt trăng/mặt trời trên header | Dark mode toàn cục, kể cả editor |

## 3. Database (table + board + filter/sort/group)

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 12 | Page menu (⋯) → **Turn into database** | Table view: Name / Status / Points / Due |
| 13 | `New row` ×3, set Status (Todo/Done/…) qua dropdown từng row | Giá trị lưu ngay (refetch) |
| 14 | **Filter / Sort** → property Status, op `eq`, value `Done` → Apply | Table chỉ còn đúng row Done |
| 15 | `+` cạnh tabs → **Board view** → tab Board | Cột theo Status (Todo/In progress/Done/No Status) + card đếm đúng |
| 16 | **Properties** → thêm/sửa/xoá cột, đổi type, options | Schema lưu, table render lại theo schema mới |
| 17 | Click tên row | Mở row như một page đầy đủ (row = page con) |

## 4. Share / Comments / History / Cover / Export / Templates

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 18 | **Share** → bật "Công khai trên web" → Copy | Link `/admin/p/<id>`; mở cửa sổ ẨN DANH (hoặc curl) → 200, trang read-only; page không public → 404 |
| 19 | **Comments** → viết → Gửi → ✓ resolve | Comment hiện kèm thời gian; resolve mờ đi; reply bằng ô "Trả lời…" |
| 20 | Page menu → **History** → Save version now → đổi title → History → Restore | Title quay về giá trị lúc snapshot |
| 21 | Page menu → **Add cover** → chọn ảnh | Ảnh upload lên UploadThing, cover hiện trên page, F5 còn |
| 22 | Page menu → **Export Markdown** / **Export PDF** | Tải file `.md` / mở hộp thoại print (sidebar/toolbar ẩn khi in) |
| 23 | Page menu → Templates → Meeting notes/Todo/Project plan | Page mới với nội dung template |
| 24 | Page menu → **Duplicate** | Bản sao "(copy)" được chọn ngay |

## 5. API surfaces

| # | URL | Kỳ vọng |
|---|-----|---------|
| 25 | `http://localhost:3004/graphql` (browser) | **Apollo Sandbox** — chạy query thật (đính cookie nếu gọi từ origin admin; trong Sandbox chỉ query `publicPage` chạy được không cần auth) |
| 26 | `http://localhost:3004/docs` | Swagger UI — mọi endpoint Try-it-out trả **mock data** (contract only) |
| 27 | Sửa 1 field trong `schema.graphql` → `pnpm codegen` | Codegen **fail ngay** vì client documents lệch schema (bằng chứng type-sync); revert bằng git |

## 6. Deploy checklist (chưa làm — chờ credentials)

1. Neon Postgres → `DATABASE_URL` cho svc-notion (Vercel env) + chạy `prisma migrate deploy` (migration files tạo trên DB có CREATEDB).
2. Vercel project cho svc-notion (Root Directory `apps/svc-notion`) + GitHub secret `VERCEL_PROJECT_ID_SVC_NOTION`.
3. Env production: `AUTH_SECRET` (chung admin+svc), `CORS_ORIGINS`, `LIVEBLOCKS_SECRET_KEY`, `UPLOADTHING_TOKEN`, `UPLOADTHING_CALLBACK_URL`, `NEXT_PUBLIC_NOTION_API_URL`; admin và svc cần chung parent domain để cookie same-site.
