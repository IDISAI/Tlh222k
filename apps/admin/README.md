# admin

Next.js app quản trị (nhân bản cấu hình từ [../web](../web)). Dev trên port **3002**. Tiêu thụ `@workspace/ui` và `@workspace/core`; [app/page.tsx](app/page.tsx) mount `NotionView` + `GraphView` từ core.

## Chạy

```bash
pnpm --filter admin dev      # http://localhost:3002
pnpm --filter admin build
```

## Deploy

Deploy lên Vercel qua workflow `deploy-staging.yml` / `release.yml` (matrix job `admin`). Cần secret `VERCEL_PROJECT_ID_ADMIN` và Vercel project có Root Directory = `apps/admin`. Xem [../../docs/onboarding/cicd.md](../../docs/onboarding/cicd.md).

> Next.js là bản đã chỉnh sửa — xem [../../AGENTS.md](../../AGENTS.md) trước khi viết code Next.
