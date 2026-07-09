# super-admin

Next.js frontend **super-admin** + **quản lý người dùng** (child zone, port **3003**). Nhân bản cấu hình từ [../web](../web). Tiêu thụ `@workspace/{ui,core}`.

## Chạy

```bash
pnpm --filter super-admin dev      # http://localhost:3003 (dev, không prefix)
pnpm --filter super-admin build
```

Truy cập thật qua host web tại `http://localhost:3000/super-admin`. Cần `svc-roadmap` ở `:3005`. Env: [.env.example](.env.example) → `.env.local`.

## Chức năng

- **Quản lý user**: [app/users](app/users) — liệt kê/đổi role, gọi API của `svc-roadmap` (bảng user đồng bộ với Clerk qua webhook).
- **Roadmap**: chia sẻ cùng dữ liệu roadmap với các zone khác qua `svc-roadmap`.
- **Auth theo role**: Clerk + [proxy.ts](proxy.ts); dev bỏ qua bằng `NEXT_PUBLIC_DEV_AUTH_ROLE`.
- **Multi-Zone path**: production URL public là `/super-admin/*`, nhưng app này build ở root để Clerk [proxy.ts](proxy.ts) chạy trước `auth()` trên Vercel. Host web strip `/super-admin` khi forward và proxy asset `/super-admin-static/*`.

## Deploy

Vercel matrix job `super-admin` (`deploy-staging.yml` / `release.yml`), secret `VERCEL_PROJECT_ID_SUPER_ADMIN`, Root Directory = `apps/super-admin`. Xem [../../docs/onboarding/cicd.md](../../docs/onboarding/cicd.md).

> Next.js là bản đã chỉnh sửa — xem [AGENTS.md](AGENTS.md) và [../../AGENTS.md](../../AGENTS.md) trước khi viết code Next.
