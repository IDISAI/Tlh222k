# roadmap

Feature `roadmap` của `@workspace/core`, sống **inline** trong monorepo `IDISAI/Tlh222k` tại `packages/core/src/roadmap` (trước là submodule, nay đã inline).

## Cấu trúc

```
roadmap/
  types.ts              — kiểu dữ liệu (Roadmap, RoadmapNode, ...)
  roadmap.service.ts    — mock service (localStorage) đằng sau seam env-flag
  api/                  — Apollo Client + provider nói GraphQL với svc-api
  hooks/use-roadmap.ts  — React hook
  components/RoadmapView.tsx
  utils/
  index.ts              — barrel

  builder/              — admin roadmap-builder (canvas, kho node, hooks)
  graph/                — sub-feature graph
  viewer/  drawer/  progress/  dashboard/   — sub-features
```

## Quy tắc

- `index.ts` là hợp đồng công khai — `packages/core/src/index.ts` làm `export * from "./roadmap"`. Xóa/đổi tên export = vỡ build của toàn monorepo.
- Logic graph nằm trong `graph/` sub-feature, không trộn lên feature root.
- **Không còn submodule:** commit thẳng ở monorepo, `main` là nhánh chính.

## Mô hình builder

**Node role/skill = roadmap** (một record). Detail của node = rooted view cùng cây (`?node={id}`), không tạo roadmap riêng, không seed, xóa vĩnh viễn, kéo = move. Chi tiết ở `CLAUDE.md` mục "Roadmap builder model" và `AGENTS.md` cạnh file này. Model này thay thế các spec cũ trong `.kiro` (Req 11, "Xóa khỏi Canvas").
