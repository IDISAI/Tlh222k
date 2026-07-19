# Agent rules — roadmap feature

Feature `roadmap` của domain logic, sống **inline** trong monorepo `IDISAI/Tlh222k` tại `packages/core/src/roadmap` bên trong `@workspace/core`. (Trước đây là git submodule — nay đã inline, không còn gitlink; bỏ qua tài liệu cũ nói clone/bump submodule.)

- **Giữ nguyên khuôn feature-first:** `types.ts`, `roadmap.service.ts`, `hooks/`, `components/`, `utils/`, và `index.ts` barrel. Sub-feature (`graph/`, `builder/`, `drawer/`, `viewer/`, `progress/`, `dashboard/`) cùng khuôn và được `index.ts` re-export lên.
- **`index.ts` là hợp đồng:** `packages/core/src/index.ts` ở repo cha làm `export * from "./roadmap"`. Xoá/đổi tên export ở đây = vỡ typecheck/build của cả monorepo.
- Import React/kiểu từ core dùng relative trong feature; `core` đặt `moduleResolution: Bundler` nên barrel `export *` không cần đuôi file.
- **Không còn submodule:** commit thẳng ở monorepo, không bump gitlink. `main` là nhánh chính.

## Mô hình builder (redesign 2026-07-19, nhánh `hf/roadmap`)

**Node role/skill CHÍNH LÀ roadmap** — một record duy nhất. Đây là model hiện hành, **thay thế** các spec cũ trong `.kiro` (đặc biệt notion-article-node Req 11 và "Xóa khỏi Canvas"/Disabled_Node của roadmap-builder-admin). Chi tiết đầy đủ ở `CLAUDE.md` mục "Roadmap builder model". Tóm tắt:

- Tạo node role/skill KHÔNG tự sinh Roadmap riêng, không seed node gốc.
- Detail của node role/skill = rooted view cùng cây: `/roadmaps/{roadmapId}?node={nodeId}` (node + con cháu). `BuilderPage` nhận `rootNodeId`.
- `nodeNavigationUrl` role/skill → `{base}/{roadmapId}?node={id}` (không bao giờ null). `linkedRoadmapId` còn trong schema/service nhưng không còn điều khiển navigation, không auto-set.
- Bảng `RoadmapListAdmin` = roadmap gốc + mọi role/skill node (cột "Loại").
- Xóa là vĩnh viễn (không "Xóa khỏi Canvas", không ghost). `roadmapGraphById` lọc `isDeleted` ở cả mock lẫn svc-api.
- Kéo node lạ từ sidebar = **move** (`moveNode`), không clone. `Node.roadmapId` một chủ sở hữu.
