# Agent rules — roadmap feature

Feature `roadmap` của domain logic, sống **inline** trong monorepo `IDISAI/Tlh222k` tại `packages/core/src/roadmap` bên trong `@workspace/core`. (Trước đây là git submodule — nay đã inline, không còn gitlink; bỏ qua tài liệu cũ nói clone/bump submodule.)

- **Giữ nguyên khuôn feature-first:** `types.ts`, `roadmap.service.ts`, `hooks/`, `components/`, `utils/`, và `index.ts` barrel. Sub-feature (`graph/`, `builder/`, `drawer/`, `viewer/`, `progress/`, `dashboard/`) cùng khuôn và được `index.ts` re-export lên.
- **`index.ts` là hợp đồng:** `packages/core/src/index.ts` ở repo cha làm `export * from "./roadmap"`. Xoá/đổi tên export ở đây = vỡ typecheck/build của cả monorepo.
- Import React/kiểu từ core dùng relative trong feature; `core` đặt `moduleResolution: Bundler` nên barrel `export *` không cần đuôi file.
- **Không còn submodule:** commit thẳng ở monorepo, không bump gitlink. `main` là nhánh chính.

## Mô hình builder hiện tại — LEGO composition (redesign 2026-07-20, nhánh `hf/roadmap`)

> ⚠️ **Model cũ (trước 2026-07-20) đã bị thay thế hoàn toàn.** Bỏ qua mọi tài liệu nhắc đến: `?node=` URL, "rooted view cùng cây", "kéo node = move", "linkedRoadmapId điều khiển navigation", "xóa subtree", hoặc auto-tạo Roadmap khi thêm node role/skill. Nguồn chuẩn: `CLAUDE.md` mục "Roadmap builder model".

Model hiện hành thay thế hoàn toàn cả spec `.kiro` lẫn model 2026-07-19.

**Nguyên tắc cốt lõi:**

- **Mỗi node role/skill/chapter là một BLOCK độc lập, sở hữu một canvas.** Canvas của block = `Composition` (`types.ts`): `{ ownerId, members: [{ nodeId, x, y }], edges: [{ id, source, target, kind }] }`. Owner render ghim trên đỉnh; `members` là các block khác đặt lên.
- **Membership thay thế cây parentId.** Một block có thể là member của nhiều canvas (reusable LEGO). `article` là leaf — chỉ hiện trong right panel của chapter (`NodeDetailDialog`), không bao giờ trên canvas.
- **Edge là entity mới** (`EdgeKind = solid | dashed`), độc lập với parentId. Vẽ edge bằng cách kéo handle (`addEdge`); chuột phải wire → đổi kind / cắt (`removeEdge`). `EdgeContextMenu`.
- **parentId / roadmapId vẫn giữ trong storage** để viewer công khai tiếp tục hoạt động. `RoadmapService.getComposition` derive composition từ parentId children khi chưa có data — không cần migration. Block mới tự own (`roadmapId === id`). Composition ops persist ngay; không có bước "Lưu" batch.
- **Detail page = canvas của một owner block** tại `/roadmaps/{nodeId}` (không có `?node=`). `BuilderPage` nhận `nodeId`; `useCompositionCanvas` + `CompositionCanvas` render. Drill vào member = nhấn "Điều hướng" trong detail panel → `{base}/{node.id}`; panel của owner ẩn nút đó (`NodeDetailDialog hideNavigate`).
- **Hai loại xóa:** Canvas remove (`removeFromCanvas`) chỉ xóa membership + edge của block đó trên canvas đang xem — block vẫn tồn tại. Sidebar/table delete (`deleteBlockPermanent`) soft-delete và purge block khỏi mọi composition.
- **Mock-first cho đến khi `NEXT_PUBLIC_SVC_API_URL` được set.** Apollo `RoadmapApi` chưa có composition methods; `service-selector.ts` cast qua gap — chỉ break khi env var có giá trị.
