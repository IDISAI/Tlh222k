# admin

Next.js frontend **quản trị** + **roadmap builder** (child zone, port **3002**). Nhân bản cấu hình từ [../web](../web). Tiêu thụ `@workspace/ui` và `@workspace/core`.

## Chạy

```bash
pnpm --filter admin dev      # http://localhost:3002 (dev, không prefix)
pnpm --filter admin build
```

Truy cập thật qua host web tại `http://localhost:3000/admin` (web rewrite sang app này). Cần `svc-roadmap` ở `:3005`. Env: [.env.example](.env.example) → `.env.local`.

## Chức năng

- **Roadmap builder**: CRUD roadmap/node dưới [app/roadmaps](app/roadmaps) và [app/roadmap](app/roadmap), ghi qua GraphQL của `svc-roadmap`.
- **Auth theo role**: Clerk + [proxy.ts](proxy.ts); chặn truy cập trả về [app/403](app/403). Dev bỏ qua Clerk bằng `NEXT_PUBLIC_DEV_AUTH_ROLE`.
- **Multi-Zone path**: production URL public là `/admin/*`, nhưng app này build ở root để Clerk [proxy.ts](proxy.ts) chạy trước `auth()` trên Vercel. Host web strip `/admin` khi forward và proxy asset `/admin-static/*`.

## Deploy

Vercel matrix job `admin` (`deploy-staging.yml` / `release.yml`), secret `VERCEL_PROJECT_ID_ADMIN`, Root Directory = `apps/admin`. Xem [../../docs/onboarding/cicd.md](../../docs/onboarding/cicd.md).

> Next.js là bản đã chỉnh sửa — xem [AGENTS.md](AGENTS.md) và [../../AGENTS.md](../../AGENTS.md) trước khi viết code Next.
