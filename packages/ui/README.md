# @workspace/ui

Thư viện UI dùng chung (shadcn/ui + Tailwind v4). Repo này là **git submodule** của monorepo, gắn tại `packages/ui`.

## Export

```ts
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import "@workspace/ui/globals.css"
```

Xem [package.json](package.json) → `exports` để biết danh sách đầy đủ. Không có build step — apps import thẳng source TypeScript.

## Thêm component

Chạy từ gốc monorepo, output tự động vào `src/components/`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Không viết tay component nếu shadcn đã có sẵn.

## Lưu ý

- **Là submodule:** commit ở repo này trước, sau đó bump gitlink ở repo cha. Xem [docs/onboarding/submodules.md](../../docs/onboarding/submodules.md).
- Đổi cấu trúc `exports` trong `package.json` = phải cập nhật tất cả app đang import.
