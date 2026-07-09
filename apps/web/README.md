# web

Next.js frontend **công khai** và là **host zone** của kiến trúc Multi-Zone (port **3000**). Tiêu thụ `@workspace/ui` và `@workspace/core`; mount roadmap (`RoadmapView`) và điều hướng theo role.

## Chạy

```bash
pnpm --filter web dev      # http://localhost:3000
pnpm --filter web build
```

Cần backend `svc-roadmap` chạy ở `:3005` để roadmap có dữ liệu. Env: copy `.env.example` → `.env.local` (xem [.env.example](.env.example) và [../../docs/onboarding/env.md](../../docs/onboarding/env.md)).

## Vai trò trong hệ thống

- **Host zone**: [next.config.ts](next.config.ts) `rewrites()` proxy `/admin` → app admin (:3002) và `/super-admin` → super-admin (:3003). Child apps build ở root để Clerk proxy chạy đúng; host strip prefix khi forward và proxy asset `/admin-static/*` / `/super-admin-static/*`. Dev trỏ tới dev server của child; prod trỏ tới domain child (override bằng `ADMIN_URL` / `SUPER_ADMIN_URL`).
- **Auth**: Clerk. [proxy.ts](proxy.ts) + [lib/](lib/) phân giải role. Dev có thể bỏ qua Clerk bằng `NEXT_PUBLIC_DEV_AUTH_ROLE`.
- **Dữ liệu roadmap**: Apollo client trong `@workspace/core` gọi `${NEXT_PUBLIC_SVC_ROADMAP_URL}/graphql`.
- **Sentry**: bọc qua `withSentryConfig` (no-op nếu không có DSN).

## Thư mục `app/`

`page.tsx`, `layout.tsx`, `roadmap/`, `roadmaps/`, `dashboard/`, `sign-in/`, `sign-up/`, `api/`.

## Dùng package nội bộ

Khai báo `workspace:*` trong [package.json](package.json), thêm vào `transpilePackages` ([next.config.ts](next.config.ts)), map `paths` ([tsconfig.json](tsconfig.json)). Ví dụ custom core: [lib/core.ts](lib/core.ts).

## Deploy

Vercel qua matrix job `web` (`deploy-staging.yml` / `release.yml`), secret `VERCEL_PROJECT_ID_WEB`, Root Directory = `apps/web`. Xem [../../docs/onboarding/cicd.md](../../docs/onboarding/cicd.md).

> Next.js ở đây là bản đã chỉnh sửa — xem [AGENTS.md](AGENTS.md) và [../../AGENTS.md](../../AGENTS.md) trước khi viết code Next.
