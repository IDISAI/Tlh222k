# Agent rules — roadmap feature

Feature `roadmap` của domain logic. Repo này là **git submodule** của monorepo `IDISAI/Tlh222k`, gắn tại `packages/core/src/roadmap` bên trong `@workspace/core`.

- **Giữ nguyên khuôn feature-first:** `types.ts`, `roadmap.service.ts`, `hooks/`, `components/`, `utils/`, và `index.ts` barrel. Sub-feature (`graph/`) cùng khuôn và được `index.ts` re-export lên.
- **`index.ts` là hợp đồng:** `packages/core/src/index.ts` ở repo cha làm `export * from "./roadmap"`. Xoá/đổi tên export ở đây = vỡ typecheck/build của cả monorepo.
- Import React/kiểu từ core dùng relative trong feature; `core` đặt `moduleResolution: Bundler` nên barrel `export *` không cần đuôi file.
- **Là submodule:** commit ở repo này rồi push; repo cha bump gitlink để ghim version. `main` là nhánh chính.
