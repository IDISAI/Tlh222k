# CI/CD Pipeline

Tài liệu này giải thích toàn bộ vòng đời từ khi bạn push code đến khi code xuất hiện trên production — từng bước, từng pipeline.

---

## Tổng quan: 3 pipeline, 3 mục đích

| File | Kích hoạt khi | Mục đích |
|------|--------------|----------|
| `.github/workflows/ci.yml` | Mọi PR + push vào `main`, `develop`, `release/**` | Bảo vệ chất lượng code |
| `.github/workflows/deploy-staging.yml` | Push vào `develop` hoặc `release/**` | Deploy lên staging (Vercel preview) |
| `.github/workflows/release.yml` | Push tag `v*` (ví dụ `v1.2.0`) | Deploy lên production + tạo GitHub Release |

---

## Sơ đồ kết nối GitFlow ↔ CI/CD

```
Developer push feature/xxx
        ↓
    Mở PR → develop
        ↓
    [ci.yml] lint → test → build       ← phải PASS mới merge được
        ↓
    Merge vào develop
        ↓
    [ci.yml] lint → test → build       ← chạy lần nữa trên develop
    [deploy-staging.yml] → Vercel Staging (web + admin song song)
        ↓
    Team test trên staging
        ↓
    Lead tạo release/1.2.0
        ↓
    [deploy-staging.yml] → Vercel Staging preview
        ↓
    Lead merge release/1.2.0 → main
    git tag v1.2.0 && git push --tags
        ↓
    [release.yml] → Vercel Production (web + admin song song)
                 → GitHub Release (sau khi cả hai pass)
```

---

## Pipeline 1: CI (`ci.yml`)

**Kích hoạt:** Mọi pull request, và push vào `main` / `develop` / `release/**`

**Các bước (theo thứ tự):**

```
1. Checkout code
2. Cài pnpm 10.30.2
3. Cài Node.js 20 (với pnpm cache)
4. pnpm install --frozen-lockfile
   → lockfile phải khớp chính xác — nếu ai thêm package mà quên commit lockfile, bước này sẽ fail
5. pnpm lint
   → thực chất là TypeScript type check (tsc --noEmit), không phải style lint
6. pnpm test
   → chạy Vitest (admin, core) + Jest (api-gateway) — KHÔNG chạy E2E Playwright
7. pnpm build
   → build toàn bộ monorepo qua Turborepo
```

**Ý nghĩa thực tế:**
- PR không thể merge vào `develop` khi CI chưa pass
- `pnpm lint` fail = TypeScript có lỗi type — không phải lỗi dấu phẩy hay khoảng trắng
- `pnpm test` KHÔNG bao gồm E2E — Playwright cần apps đang chạy, không thể chạy trong CI thông thường

**Chạy CI locally trước khi push:**
```bash
pnpm lint    # TypeScript type check
pnpm test    # unit tests
pnpm build   # đảm bảo build không lỗi
```

---

## Pipeline 2: Deploy Staging (`deploy-staging.yml`)

**Kích hoạt:** Push vào `develop` hoặc `release/**`

**Chạy song song 2 job độc lập:**

```
deploy-web-staging                    deploy-admin-staging
──────────────────                    ────────────────────
checkout + pnpm install               checkout + pnpm install
pnpm build (toàn bộ monorepo)         pnpm build (toàn bộ monorepo)
vercel pull                           vercel pull
vercel build                          vercel build
vercel deploy --prebuilt              vercel deploy --prebuilt
      ↓                                     ↓
Vercel Staging (web)              Vercel Staging (admin)
```

**3 bước deploy Vercel:**

| Lệnh | Làm gì |
|------|--------|
| `vercel pull` | Tải cấu hình project + env vars từ Vercel về CI runner, dùng `VERCEL_PROJECT_ID` để biết project nào |
| `vercel build` | Build locally trên CI runner theo format Vercel output |
| `vercel deploy --prebuilt` | Upload build artifact lên Vercel — server chỉ serve, không build lại |

**Tại sao dùng chiến lược prebuilt?**

Vercel có hai cách deploy:
```
Cách thông thường (KHÔNG dùng):
  CI → upload source → Vercel server → npm install → FAIL
       Vercel server không hiểu pnpm workspace:* protocol

Cách prebuilt (đang dùng):
  CI → pnpm build → vercel build → upload artifact → Vercel server chỉ serve
       Build xảy ra trên CI runner nơi pnpm đã được cài sẵn
```

**Cách phân biệt web vs admin:** Mỗi job dùng biến `VERCEL_PROJECT_ID` khác nhau:
- Web job: `VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_WEB }}`
- Admin job: `VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_ADMIN }}`

Vercel sẽ tự biết cần build app nào dựa vào project ID.

**`vercel.json` trong mỗi app** chỉ cần khai báo:
```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build"
}
```

---

## Pipeline 3: Release / Production (`release.yml`)

**Kích hoạt:** Push tag có format `v*` (ví dụ `v1.0.0`, `v1.2.3`)

**Cách tạo release (lead làm):**

```bash
git checkout main
git merge --no-ff release/1.2.0
git tag v1.2.0
git push origin main v1.2.0    # push cả branch và tag cùng lúc
```

**Job dependency:**

```
deploy-web-production ──┐
                        ├──→ (cả hai thành công) ──→ github-release
deploy-admin-production─┘
```

`github-release` chạy SAU KHI cả hai deploy thành công (`needs: [deploy-web-production, deploy-admin-production]`). Nó tự tạo GitHub Release với release notes được generate từ commit messages.

**Khác với staging:** Production dùng `--prod` flag:
```
vercel build --prod        → build cho production domain
vercel deploy --prebuilt --prod  → deploy lên production (không phải preview URL)
```

---

## GitHub Secrets cần thiết

Vào **GitHub repo → Settings → Secrets and variables → Actions** để cấu hình:

| Secret | Lấy từ đâu | Dùng bởi |
|--------|-----------|----------|
| `VERCEL_TOKEN` | Vercel Dashboard → Account Settings → Tokens | Tất cả deploy jobs |
| `VERCEL_ORG_ID` | Vercel Dashboard → Team/Account → General → Team ID | Tất cả deploy jobs |
| `VERCEL_PROJECT_ID_WEB` | Vercel project `web` → Settings → General → Project ID | Web deploy jobs |
| `VERCEL_PROJECT_ID_ADMIN` | Vercel project `admin` → Settings → General → Project ID | Admin deploy jobs |
| `VERCEL_PROJECT_ID_SUPER_ADMIN` | Vercel project `super-admin` → Project ID (chú ý: dấu `_`, không phải `-`) | Super-admin deploy jobs |
| `SUBMODULE_PAT` | GitHub → Settings → Developer settings → PAT có quyền đọc repo `IDISAI/*` | Tất cả job (checkout submodule) |

**Lưu ý:** `VERCEL_PROJECT_ID_WEB` ≠ `VERCEL_PROJECT_ID` — tên phải khớp chính xác với tên secret trong workflow.

**Submodule trong CI:** `packages/ui` và các feature trong `packages/core/src` là submodule private. Mọi workflow checkout với `submodules: recursive` và `token: ${{ secrets.SUBMODULE_PAT || github.token }}`. Thiếu `SUBMODULE_PAT` → không clone được submodule → build fail (`github.token` mặc định chỉ đọc repo hiện tại). Deploy jobs dùng **matrix** `app: [web, admin, super-admin]`, mỗi app map tới `VERCEL_PROJECT_ID_<PROJECT>` (suffix viết hoa, `super-admin` → `SUPER_ADMIN`).

---

## Môi trường Vercel

| Môi trường | Trigger | URL |
|-----------|---------|-----|
| **Preview** | `vercel deploy --prebuilt` (không có `--prod`) | `https://<hash>-<team>.vercel.app` — URL mới mỗi lần deploy |
| **Production** | `vercel deploy --prebuilt --prod` | Domain chính đã cấu hình trong Vercel |

Staging deploy tạo **Preview URL** — mỗi deploy sinh ra URL mới. Production deploy cập nhật domain chính.

---

## Tại sao E2E không chạy trên CI?

Playwright E2E tests (`apps/e2e`) cần tất cả apps đang chạy cùng lúc:
- `apps/web` trên `:3001`
- `apps/admin` trên `:3002`  
- `apps/api-gateway` trên `:3000`
- PostgreSQL trên `:5432`

CI runner không có database và không khởi động apps trước khi chạy test. Vì vậy E2E chỉ chạy thủ công trong quá trình phát triển (`pnpm --filter @vizteck/e2e test:e2e`).

---

## Kiểm tra trạng thái CI/CD

- **GitHub Actions:** Tab `Actions` trong repo — xem tất cả workflow runs và log từng step
- **Vercel deployments:** Vercel Dashboard → chọn project → Deployments
- **Log chi tiết:** Click vào một run → click từng step để expand

---

## Xử lý lỗi thường gặp

**CI fail tại `pnpm install --frozen-lockfile`**
Ai đó thêm dependency mà không commit `pnpm-lock.yaml`. Chạy `pnpm install` local và commit lockfile.

**CI fail tại `pnpm lint`**
TypeScript type error. Chạy `pnpm lint` local để xem lỗi cụ thể.

**CI fail tại `pnpm test`**
Test fail. Chạy `pnpm test` local hoặc `pnpm --filter @vizteck/<package> test` để debug.

**CI fail tại `pnpm build`**
Build error. Chạy `pnpm build` local — Turborepo sẽ chỉ ra package nào fail.

**Deploy fail: Vercel secrets không tìm thấy**
Kiểm tra GitHub Secrets đã được set đúng tên. `VERCEL_PROJECT_ID_WEB` ≠ `VERCEL_PROJECT_ID`.

**Khi nào nên re-run CI?**
- Test fail do **flaky network** (timeout khi fetch external service): re-run có thể pass
- Test fail do **code lỗi**: không re-run — fix code trước

---

## Liên quan

- [Quy trình làm việc hàng ngày](./daily-workflow.md) — lifecycle feature → develop → release
- [Kiểm thử](./testing.md) — cách viết và chạy tests
