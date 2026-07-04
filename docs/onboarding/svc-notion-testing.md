# svc-notion — Hướng dẫn kiểm tra thủ công (manual testing)

Backend service của feature Notion: `apps/svc-notion` (Hono, Clean Architecture).
REST là bề mặt API đầy đủ (Swagger tự sinh từ zod), GraphQL phủ các flow chính.

## 0. Chuẩn bị

```bash
# Postgres local phải chạy trên :5432 (DB vizteckstack, user vizteck)
cp .env.example  # xem section svc-notion → tạo apps/svc-notion/.env
pnpm install
pnpm --filter @workspace/db db:push   # sync schema vào Postgres (schema "notion")
pnpm --filter svc-notion dev          # http://localhost:3004
```

Sanity check: mở `http://localhost:3004/` → JSON `{ service: "svc-notion", ... }`.

## 1. Kiểm tra qua Swagger UI (không cần curl)

Mở **http://localhost:3004/docs** — mọi endpoint đều "Try it out" được.
Thứ tự test một vòng đầy đủ:

| # | Endpoint | Làm gì | Kết quả mong đợi |
|---|----------|--------|------------------|
| 1 | `POST /workspaces` | body `{"name":"Test"}` | 201, có `id` → **copy `wsid`** |
| 2 | `POST /pages` | `{"workspaceId":"<wsid>","title":"Docs"}` | 201, `rank:"a0"` → copy `p1` |
| 3 | `POST /pages` | thêm `"parentId":"<p1>"`, title "Guide" | 201, `parentId` = p1 → copy `p2` |
| 4 | `GET /workspaces/{id}/pages` | id = wsid | mảng 2 page, không có `content` |
| 5 | `PATCH /pages/{id}` | id = p1, body `{"content":[{"id":"b1","type":"paragraph","content":"Hi"}],"icon":"📘"}` | 200, `content` lưu nguyên vẹn |
| 6 | `GET /pages/{id}` | id = p1 | 200, thấy `content` + `icon` |
| 7 | `POST /pages/{id}/database` | id = p2, body `{"propertySchema":[{"id":"status","name":"Status","type":"select","options":["Todo","Done"]}]}` | 201 → copy `dbid` |
| 8 | `POST /databases/{id}/rows` | 2 lần: `{"title":"A","properties":{"status":"Todo"}}` và `{"title":"B","properties":{"status":"Done"}}` | 201 mỗi lần |
| 9 | `POST /databases/{id}/views` | `{"type":"BOARD","name":"Done","config":{"filters":[{"propertyId":"status","op":"eq","value":"Done"}]}}` | 201 → copy `viewId` |
| 10 | `GET /databases/{id}/rows?viewId=<viewId>` | | **chỉ còn row B** (filter chạy) |
| 11 | `POST /pages/{id}/comments` | id = p1, `{"body":"Note","blockId":"b1"}` | 201 → copy `cmid` |
| 12 | `PATCH /comments/{id}` | `{"resolved":true}` | 200, `resolvedAt` khác null |
| 13 | `PUT /favorites/{id}` | id = p1 (pageId) | 200; `GET /favorites` thấy 1 item |
| 14 | `POST /pages/{id}/versions` | id = p1 | 201 → copy `vid` |
| 15 | `PATCH /pages/{id}` | đổi `{"title":"CHANGED"}` | 200 |
| 16 | `POST /versions/{id}/restore` | id = vid | 200, **title quay về "Docs"** |
| 17 | `GET /workspaces/{id}/search?q=guide` | id = wsid | tìm thấy page "Guide" |
| 18 | `DELETE /pages/{id}` | id = p2 | 200 (soft delete) |
| 19 | `GET /workspaces/{id}/trash` | | thấy "Guide" trong trash |
| 20 | `POST /pages/{id}/restore` | id = p2 | 200, biến mất khỏi trash |
| 21 | `POST /workspaces` | body `{"name":""}` | **400** (validation chặn) |

## 2. Kiểm tra GraphQL sandbox

Mở **http://localhost:3004/graphql** (GraphiQL). Chạy:

```graphql
{ workspaces { id name } }

mutation { createPage(workspaceId: "<wsid>", title: "Từ GraphQL") { id title rank } }

{ search(workspaceId: "<wsid>", query: "docs") { title } favorites { pageId } }
```

Kỳ vọng: data trả về khớp những gì đã tạo bên REST (cùng một DB, cùng use-cases).

## 3. Kiểm tra CORS (cho frontend gọi từ admin :3002)

```bash
curl -s -D - -o /dev/null -H "Origin: http://localhost:3002" http://localhost:3004/workspaces | grep -i access-control
# Kỳ vọng: access-control-allow-origin: http://localhost:3002
```

## 4. Những gì CHƯA có (đừng báo bug)

- **Auth chưa có** — mọi write gán cho user `demo@local`. Không promote service này lên
  production công khai trước khi gắn Auth.js (phase kế tiếp).
- GraphQL không phủ database views CRUD (REST phủ đủ).
- Search chỉ match title (chưa full-text vào content).
- `prisma migrate` chưa chạy được trên Postgres local (user thiếu quyền CREATEDB) —
  dùng `db:push`; migration files sẽ tạo khi có DB đủ quyền (vd Neon).

## 5. Kiểm tra UI (admin — NotionView)

```bash
pnpm --filter svc-notion dev   # terminal 1 — backend :3004
pnpm --filter admin dev        # terminal 2 — frontend :3002
```

Mở **http://localhost:3002/admin** và click theo:

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Đợi trang load | Sidebar hiện "My Workspace" (tự tạo lần đầu) + page đầu tiên tự mở trong editor |
| 2 | Nút `+` cạnh "Pages" | Page mới xuất hiện trong tree và được chọn, editor trống với placeholder "Enter text or type '/'" |
| 3 | Gõ title + gõ nội dung vào editor | Sau ~1s indicator chuyển "Đang lưu…" → "Đã lưu"; F5 lại trang nội dung vẫn còn |
| 4 | Gõ `/` trong editor | Slash menu của BlockNote hiện (heading, list, todo, code…) |
| 5 | Hover page trong tree → icon `+` | Tạo sub-page, tree expand |
| 6 | Hover → icon ngôi sao | Page hiện trong section Favorites |
| 7 | Hover → icon thùng rác | Page biến khỏi tree; mở "Trash" thấy nó, bấm restore quay lại |
| 8 | Nút "Search" → gõ từ khoá | Kết quả hiện sau ~300ms, click mở đúng page |
| 9 | (Persist check bằng API) `curl http://localhost:3004/pages/<id>` | `content` chứa đúng blocks vừa gõ |

## 6. Deploy checklist (Vercel)

1. Tạo Vercel project mới, Root Directory = `apps/svc-notion`.
2. Set env trong project: `DATABASE_URL` (Neon/Postgres có `?schema=notion` nếu dùng chung DB), `CORS_ORIGINS` = domain các frontend.
3. Thêm GitHub secret `VERCEL_PROJECT_ID_SVC_NOTION` (matrix đã có sẵn trong workflows).
4. Push `develop` → preview deploy; verify `https://<deploy-url>/docs` mở được Swagger.
