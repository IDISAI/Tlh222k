# lh222k

Turborepo + pnpm monorepo. Frontend Next.js dùng chung UI và domain logic qua các package nội bộ; một phần code được tách ra repo riêng bằng **git submodule**.

## Yêu cầu

- Node ≥ 20
- pnpm 10.33.4 (đã ghim trong `packageManager`)

## Bắt đầu

```bash
git clone --recurse-submodules <repo-url>   # QUAN TRỌNG: kèm submodule
cd lh222k
pnpm install
pnpm dev
```

Lỡ clone thiếu submodule: `git submodule update --init --recursive`. Xem [docs/onboarding/submodules.md](docs/onboarding/submodules.md).

## Lệnh thường dùng

| Lệnh | Việc |
|------|------|
| `pnpm dev` | Chạy dev toàn bộ app (turbo) |
| `pnpm build` | Build toàn monorepo |
| `pnpm lint` | ESLint (lint thật) |
| `pnpm typecheck` | `tsc --noEmit` (task riêng với lint) |
| `pnpm format` | Prettier |
| `pnpm --filter web <script>` | Chạy 1 package, vd `pnpm --filter web dev` |

Chưa có test runner. Chuỗi CI = `install --frozen-lockfile → lint → typecheck → build`.

## Cấu trúc

```
apps/
  web/          Next.js app — public (mount RoadmapView)
  admin/        Next.js app — quản trị, port 3002 (mount NotionView + GraphView)
  super-admin/  Next.js app — port 3003 (mount RoadmapView + NotionView)
packages/
  core/         @workspace/core — domain logic (feature-first)
    src/roadmap/  ← submodule: IDISAI/roadmap
  ui/           @workspace/ui  ← submodule: IDISAI/ui (shadcn/ui)
  eslint-config/, typescript-config/  cấu hình dùng chung
```

`apps/*` import từ `packages/*`; không bao giờ ngược lại. Chi tiết: [rules/packages.md](rules/packages.md).

## Thêm shadcn/ui component

Chạy ở gốc, output vào `packages/ui/src/components`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Dùng: `import { Button } from "@workspace/ui/components/button"`

## Tài liệu

- [Kiến trúc](docs/onboarding/architecture.md) · [Bắt đầu](docs/onboarding/getting-started.md) · [Quy trình ngày](docs/onboarding/daily-workflow.md)
- [CI/CD](docs/onboarding/cicd.md) · [Biến môi trường (.env)](docs/onboarding/env.md) · [Submodules](docs/onboarding/submodules.md) · [Git hooks](docs/onboarding/git-hooks.md)
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) — hướng dẫn cho AI agent
