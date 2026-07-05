# super-admin

Next.js app super-admin (nhân bản cấu hình từ [../web](../web)). Dev trên port **3003**. Tiêu thụ `@workspace/{ui,core}`; [app/page.tsx](app/page.tsx) mount `RoadmapView`.

## Chạy

```bash
pnpm --filter super-admin dev      # http://localhost:3003
pnpm --filter super-admin build
```

## Deploy

Deploy Vercel qua matrix job `super-admin` trong `deploy-staging.yml` / `release.yml`. Cần secret `VERCEL_PROJECT_ID_SUPER_ADMIN` và Vercel project có Root Directory = `apps/super-admin`. Xem [../../docs/onboarding/cicd.md](../../docs/onboarding/cicd.md).
