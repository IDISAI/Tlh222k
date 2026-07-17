# Cheat Sheet cho Developer

> **⚠️ Lưu ý:** Cheat sheet này được viết cho hệ thống target (NestJS, Prisma, test runner, apps/e2e). **Phần hiện đang hoạt động:** lệnh pnpm (mục 1 — bỏ `pnpm test`), naming conventions (mục 7, 8), CI/CD triggers (mục 12).

Tham chiếu nhanh hàng ngày: lệnh, ports, biến môi trường, nhánh, commit, packages, data model, auth, CI/CD và xử lý lỗi.

---

## 1. Lệnh thường dùng

### Phát triển hàng ngày

```bash
pnpm dev              # Khởi động tất cả apps ở chế độ watch
pnpm build            # Build tất cả packages (theo thứ tự dependency Turborepo)
pnpm lint             # ESLint toàn monorepo
pnpm typecheck        # tsc --noEmit (task riêng với lint)
pnpm format           # Prettier --write
# pnpm test           # Chưa có test runner
```

### Theo từng package

```bash
pnpm --filter @vizteck/admin test          # Vitest — admin
pnpm --filter @vizteck/api-gateway test    # Jest — api-gateway
pnpm --filter @vizteck/core test           # Vitest — core
pnpm --filter @vizteck/lesson test         # Vitest — lesson (passWithNoTests)
```

### Database (cần chạy với DATABASE_URL)

```bash
DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/tlh222k" \
  pnpm --filter @vizteck/db db:push      # Đẩy schema (không tạo migration file)

DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/tlh222k" \
  pnpm --filter @vizteck/db db:migrate   # Tạo và áp dụng migration

DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/tlh222k" \
  pnpm --filter @vizteck/db db:seed      # Seed dữ liệu demo

DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/tlh222k" \
  pnpm --filter @vizteck/db db:studio    # Mở Prisma Studio trên trình duyệt
```

### Docker

```bash
docker compose up -d postgres    # Khởi động PostgreSQL
docker compose down              # Dừng và xoá containers
docker compose ps                # Kiểm tra trạng thái container
```

---

## 2. Test theo từng package

| Package            | Filter                 | Framework                       | File pattern                              |
| ------------------ | ---------------------- | ------------------------------- | ----------------------------------------- |
| `apps/admin`       | `@vizteck/admin`       | Vitest + @testing-library/react | `src/**/*.spec.tsx`                       |
| `apps/api-gateway` | `@vizteck/api-gateway` | Jest + ts-jest                  | `src/**/*.spec.ts`                        |
| `packages/core`    | `@vizteck/core`        | Vitest + @testing-library/react | `src/**/*.spec.ts(x)`                     |
| `packages/lesson`  | `@vizteck/lesson`      | Vitest                          | passWithNoTests (specs di chuyển về core) |
| `apps/e2e`         | `@vizteck/e2e`         | Playwright                      | Cần tất cả apps đang chạy                 |

---

## 3. Test watch mode

```bash
# Admin (Vitest) — watch mode
pnpm --filter @vizteck/admin test -- --watch

# Hoặc dùng script test:watch trong package
pnpm --filter @vizteck/admin test:watch

# api-gateway (Jest) — watch mode
pnpm --filter @vizteck/api-gateway test -- --watch
```

---

## 4. E2E tests (Playwright)

> Yêu cầu: tất cả apps phải đang chạy (`pnpm dev`) trước khi chạy e2e.

```bash
pnpm --filter @vizteck/e2e test:e2e     # Headless (CI)
pnpm --filter @vizteck/e2e test:ui      # Interactive UI mode
pnpm --filter @vizteck/e2e test:headed  # Headed browser
pnpm --filter @vizteck/e2e test:report  # Xem báo cáo lần chạy trước
```

---

## 5. Ports

| Service                      | Port | URL                            |
| ---------------------------- | ---- | ------------------------------ |
| `apps/web`                   | 3001 | http://localhost:3001          |
| `apps/admin`                 | 3002 | http://localhost:3002          |
| `apps/api-gateway`           | 3000 | http://localhost:3000          |
| `apps/api-gateway` — GraphQL | 3000 | http://localhost:3000/graphql  |
| `apps/api-gateway` — Swagger | 3000 | http://localhost:3000/api-docs |
| PostgreSQL                   | 5432 | `localhost:5432`               |

---

## 6. Biến môi trường

| Biến                  | Giá trị mặc định                                      | Dùng bởi                          |
| --------------------- | ----------------------------------------------------- | --------------------------------- |
| `DATABASE_URL`        | `postgresql://vizteck:vizteck@localhost:5432/tlh222k` | `packages/db`, `apps/api-gateway` |
| `ADMIN_TOKEN`         | `supersecret`                                         | `apps/api-gateway`                |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000`                               | `apps/web`, `apps/admin`          |
| `PORT`                | `3000`                                                | `apps/api-gateway`                |
| `UPLOADTHING_TOKEN`   | _(bắt buộc)_                                          | `apps/admin` — upload ảnh cover   |

**Cách cấu hình:**

- NestJS app (`api-gateway`): copy `.env.example` → `.env`
- Next.js apps (`web`, `admin`): copy `.env.example` → `.env.local`

---

## 7. Đặt tên nhánh

| Loại                                | Pattern               | Gốc từ    | Ví dụ                      |
| ----------------------------------- | --------------------- | --------- | -------------------------- |
| Tính năng mới / bugfix thông thường | `feature/<tên>`       | `develop` | `feature/lesson-crud`      |
| Fix khẩn cấp production             | `hotfix/<tên>`        | `main`    | `hotfix/fix-loi-dang-nhap` |
| Chuẩn bị release                    | `release/<phiên bản>` | `develop` | `release/1.2.0`            |

**Quy tắc:** lowercase, kebab-case. Không viết hoa, không khoảng trắng, không dùng `feature/LessonCRUD`.

---

## 8. Commit types (Conventional Commits)

Format: `<type>: <mô tả ngắn>` — chữ thường, không dấu chấm cuối.

| Type       | Khi nào dùng                    | Ví dụ                                  |
| ---------- | ------------------------------- | -------------------------------------- |
| `feat`     | Tính năng mới                   | `feat: add lesson CRUD endpoints`      |
| `fix`      | Sửa lỗi                         | `fix: node drop broken on canvas`      |
| `chore`    | Bảo trì, dependencies, config   | `chore: update prisma schema`          |
| `refactor` | Tái cấu trúc, không đổi hành vi | `refactor: extract graph save logic`   |
| `test`     | Thêm hoặc sửa tests             | `test: add unit tests for graph hooks` |
| `docs`     | Chỉ thay đổi tài liệu           | `docs: update onboarding guide`        |
| `ci`       | Thay đổi cấu hình CI/CD         | `ci: fix deploy workflow`              |

---

## 9. Packages dùng chung

| Package           | Import path       | Xuất ra                                                                                                 |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/core`   | `@vizteck/core`   | Toàn bộ logic nghiệp vụ: services, hooks, components, types cho roadmap và lesson                       |
| `packages/db`     | `@vizteck/db`     | `db` (PrismaClient singleton) + tất cả Prisma types                                                     |
| `packages/ui`     | `@vizteck/ui`     | Components: `Button`, `Card`, `NodeBadge`                                                               |
| `packages/graph`  | `@vizteck/graph`  | **Shim** — re-export `RoadmapGraph`, `RoadmapNode`, graph types từ `@vizteck/core`                      |
| `packages/lesson` | `@vizteck/lesson` | **Shim** — re-export `LessonEditor`, `LessonViewer`, `LessonPageShell`, lesson types từ `@vizteck/core` |

**Quy tắc dependency:** `apps/*` import từ `packages/*`; `packages/core` import từ `packages/graphql-client`, `packages/ui`, `@xyflow/react`; `packages/graph` và `packages/lesson` chỉ import từ `packages/core`; `packages/*` không được import từ `apps/*`.

---

## 10. Data model

| Model     | Field quan trọng                                                       | Ghi chú                                                                                                                        |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Roadmap` | `id`, `slug`, `title`, `status`                                        | `status`: `DRAFT` / `PUBLIC` / `PRIVATE`. Web viewer chỉ hiển thị `PUBLIC`.                                                    |
| `Node`    | `id`, `roadmapId`, `type`, `positionX/Y`, `content`, `targetRoadmapId` | `positionX/Y = null` → node tồn tại nhưng chưa đặt lên canvas. `content` là BlockNote JSON (chỉ có nghĩa khi `type = LESSON`). |
| `Edge`    | `id`, `roadmapId`, `sourceId`, `targetId`                              | Kết nối giữa các nodes trong cùng roadmap.                                                                                     |

---

## 11. Admin auth

Dùng một Bearer token tĩnh — không có user management.

```
Authorization: Bearer supersecret
```

- Token được set qua `ADMIN_TOKEN` trong `apps/api-gateway/.env`.
- Frontend lấy token từ `localStorage('admin_token')`.
- `apiFetch` trong `apps/admin/src/lib/api.ts` tự động đính kèm token và redirect về `/login` khi nhận 401.
- Nhập token lần đầu tại trang `http://localhost:3002/login`.

---

## 12. CI/CD triggers

| Trigger                               | Pipeline                                                    | Deploy tới |
| ------------------------------------- | ----------------------------------------------------------- | ---------- |
| PR hoặc push vào main/develop/release | `lint → typecheck → build`                                  | —          |
| Push vào `develop` / `release/**`     | `lint → typecheck → build → Vercel deploy (3 apps)`         | Staging    |
| Push tag `v*`                         | `lint → typecheck → build → Vercel deploy + GitHub Release` | Production |

PR không được merge cho đến khi CI pass.

---

## 13. Xử lý lỗi nhanh

| Triệu chứng                                          | Nguyên nhân thường gặp                                                    | Cách fix                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Trang mới trả về 404 dù file đã tồn tại              | Stale `.next/` cache từ `next build` lẫn vào `next dev` (Turbopack)       | `rm -rf apps/admin/.next` rồi restart `pnpm dev`                                                             |
| Node bị `visibility: hidden` sau khi update position | `measuredRef` cache trong `RoadmapGraph` bị bỏ qua                        | Không xoá hoặc bypass cache `measuredRef` trong `packages/core/src/roadmap/graph/`                           |
| Content bài học bị mất sau save                      | Gọi `POST /api/roadmaps/:id/graph` thay vì `PATCH /api/nodes/:id/content` | Dùng endpoint `PATCH` riêng cho content và title — không dùng UpsertGraph để save lesson                     |
| FOUC (flash màu sai) khi tải trang admin             | Script blocking dark mode chưa được chạy                                  | Kiểm tra `<script>` blocking trong `apps/admin/src/app/layout.tsx`                                           |
| Node mới từ palette bị parse sai tên                 | `title` trong drag payload chứa ký tự đặc biệt                            | Dùng `parts.slice(3).join(':')` rồi `decodeURIComponent` khi parse `"newRoadmap:<id>:<slug>:<encodedTitle>"` |
| Admin bị redirect về `/login` liên tục               | Token không có trong `localStorage` hoặc sai                              | Vào `http://localhost:3002/login`, nhập lại `ADMIN_TOKEN`                                                    |
