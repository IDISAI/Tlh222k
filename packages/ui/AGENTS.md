# Agent rules — @workspace/ui

Thư viện UI (shadcn/ui, Tailwind v4) dùng chung. Repo này là **git submodule** của monorepo `IDISAI/Tlh222k`, được gắn tại `packages/ui` và tiêu thụ dưới tên `@workspace/ui`.

- **Không có build step:** `exports` trong [package.json](package.json) trỏ thẳng vào source (`./src/components/*.tsx`, `./src/lib/*.ts`, `./src/hooks/*.ts`). Đổi cấu trúc export = phải cập nhật cả app tiêu thụ.
- **Thêm component:** dùng shadcn CLI từ gốc monorepo (`pnpm dlx shadcn@latest add <name> -c apps/web`), component rơi vào `src/components/`. Đừng viết tay nếu shadcn có sẵn.
- Import nội bộ dùng path alias `@workspace/ui/*` (xem [tsconfig.json](tsconfig.json)), không dùng relative sâu.
- **Là submodule:** commit ở repo này rồi push; repo cha phải bump gitlink mới thấy thay đổi. `main` là nhánh chính.
