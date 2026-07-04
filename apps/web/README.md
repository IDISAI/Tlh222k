# web

Next.js app công khai (public). Tiêu thụ `@workspace/ui` và `@workspace/core`.

## Chạy

```bash
pnpm --filter web dev      # dev server
pnpm --filter web build    # production build
```

## Dùng package nội bộ

Khai báo trong [package.json](package.json) (`workspace:*`), thêm vào `transpilePackages` ở [next.config.ts](next.config.ts), và map `paths` trong [tsconfig.json](tsconfig.json). Ví dụ bọc/custom lại core: [lib/core.ts](lib/core.ts).

> Next.js ở đây là bản đã chỉnh sửa — xem [../../AGENTS.md](../../AGENTS.md) trước khi viết code Next.
