# roadmap

Feature `roadmap` của `@workspace/core`. Repo này là **git submodule** (`IDISAI/roadmap`), gắn tại `packages/core/src/roadmap`.

## Cấu trúc

```
roadmap/
  types.ts              — kiểu dữ liệu (Roadmap, RoadmapNode, ...)
  roadmap.service.ts    — gọi API
  hooks/use-roadmap.ts  — React hook
  components/RoadmapView.tsx
  utils/format-roadmap.ts
  index.ts              — barrel

  graph/                — sub-feature
    types.ts
    graph.service.ts
    hooks/use-graph.ts
    components/GraphView.tsx
    utils/format-graph.ts
    index.ts
```

## Quy tắc

- `index.ts` là hợp đồng công khai — `packages/core/src/index.ts` làm `export * from "./roadmap"`. Xóa/đổi tên export = vỡ build của toàn monorepo.
- Logic graph nằm trong `graph/` sub-feature, không trộn lên feature root.
- **Là submodule:** commit ở repo này rồi push; repo cha bump gitlink để ghim version mới.
