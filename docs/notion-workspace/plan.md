# Notion Workspace — plan cho 4 yêu cầu

Branch: `feat/notion-workspace`. Trạng thái: plan, chưa code.

## Hiện trạng (facts trong code)

- **Notion Document** (`packages/db` Prisma) luôn nằm ở DB của app web/admin.
  Cây: 1 root doc (`slug != null`) → các child (`parentDocumentId`, `slug = null`).
  `NotionService.create` KHÔNG set slug cho child.
- **Roadmap Node** (`svc-api` DB khi bật `NEXT_PUBLIC_SVC_API_URL`, hoặc
  mock/localStorage khi trống). Store KHÁC store của Document.
- Nối 2 store bằng **`slug`**: `node.slug == Document.slug`. Chỉ đúng cho root doc
  ↔ 1 article node hiện nay.
- Routing article → notion dùng `node.slug` (`resolveArticleTarget`), KHÔNG dùng
  `notionPageId`. `notionPageId` là field chết (legacy), nhưng `NodeEditPanel` vẫn
  bắt buộc nhập.
- Hierarchy node: role(1) → skill(2) → chapter(3) → article(4). Article là leaf,
  không có con (`LEAF_NODE_CANNOT_HAVE_CHILDREN`).
- Chapter navigation đang TẮT: `NodeDetailDialog` `node.nodeType !== "chapter"`,
  `nodeNavigationUrl` chỉ role/skill → `/roadmap/[slug]`.
- `graphById`/`roadmapBySlug` đã hỗ trợ nav theo node-slug subtree cho role/skill.

## Quyết định kiến trúc (cần user chốt)

### QĐ-1: Document map với node nào?

Yêu cầu #3 (tạo page trong notion = tạo article node con của chapter) chỉ hợp lý
nếu:

- **notion root doc ↔ chapter node** (level 3)
- **child docs ↔ article nodes** (level 4) dưới chapter đó

Đây gọi là **model A1**. Khác hiện tại (root doc ↔ article node). A1 cho:

- Sidebar notion khi mở từ 1 chapter = cây `chapter + các article con`.
- "Trang mới" dưới root = tạo article node con, `parentId = chapter node`.
- `Document.slug = node.slug` cho MỌI node trong cây (không chỉ root).

Hệ quả: article node giờ có thể "có nội dung notion" nhưng vẫn là leaf trên canvas
roadmap. Notion không cho lồng article-trong-article (khớp leaf rule). Nếu user muốn
lồng sâu hơn 1 cấp trong notion thì phá vỡ hierarchy — cần cấm ở UI sidebar (chỉ cho
thêm page ở cấp root/chapter).

> **Khuyến nghị: A1.** Đúng mental model của user, tôn trọng leaf rule (cấm lồng
> article). Chi phí: đổi chỗ auto-create root doc từ theo article-slug sang theo
> chapter-slug, và set slug cho mọi child doc mới.

### QĐ-2: Nguồn sự thật cho title (yêu cầu #1)

`node.title` và `Document.title` ở 2 store khác nhau, không có transaction chung.
Chọn 1 hướng ghi để tránh vòng lặp cập nhật:

- **Hướng canonical = Notion.** Sửa title trong notion → cập nhật node qua roadmap
  service. Sửa title node trong builder → cập nhật Document. Mỗi bên chỉ ghi bên kia
  1 lần, không phát lại. Chấp nhận eventual-consistency (2 store, không txn) — drift
  hiếm, tự lành ở lần sửa sau.
- Cần 1 hàm nối `syncTitle(slug, title)` ở tầng app (Server Action) gọi cả 2 service,
  vì `packages/core` không được import ngược lên app.

> **Khuyến nghị:** ghi cả 2 phía tại Server Action, không nhét cross-service call vào
> trong `packages/core` service (giữ hướng phụ thuộc apps → packages).

### QĐ-3: role/skill node = roadmap? (yêu cầu #4)

"Add node role/skill trong canvas = tạo roadmap mới, bảng quản lý tự thêm."
Cần chốt: MỌI role node đẻ 1 Roadmap, hay chỉ role top-level? Skill có đẻ roadmap
không, hay chỉ role? (Yêu cầu ghi "role/skill" nhưng roadmap thường = 1 role.)

> **Khuyến nghị:** chỉ **role** node top-level tạo Roadmap. Skill là node con trong
> roadmap, không tự đẻ roadmap. Cần user xác nhận.

## Kế hoạch theo thứ tự (nhỏ → lớn)

### Phase 1 — Bỏ field `notionPageId` (nhỏ, rõ)

- `NodeEditPanel.tsx`: xoá state `notionPageId`, block validate dòng 64-66, input
  dòng 168-178, và nhánh gán `input.notionPageId` dòng 86. Khi chọn "notion" chỉ cần
  set `articleType="notion"`; slug đã có sẵn trên node.
- Không cần migration DB gấp (cột để đó, ngừng đọc/ghi). Có thể drop cột sau.
- Test: tạo/sửa article notion không còn đòi Page ID; điều hướng vẫn ra `/notion/[slug]`.

### Phase 2 — Chapter → detail page (#2)

- `nodeNavigationUrl`: cho `nodeType === "chapter"` trả `/roadmap/${node.slug}`.
- `NodeDetailDialog`: bỏ chặn `!== "chapter"` ở `canNavigate`.
- `roadmapBySlug`/`graphById`: mở rộng nav node-slug subtree cho chapter (hiện chỉ
  role/skill). Chapter slug → chapter + article con.
- `RoadmapViewer`: đảm bảo render subtree gốc-chapter (slider, canvas cha→con).
- Test: click "Điều hướng" trên chapter → trang canvas hiện các article con.

### Phase 3 — Title sync (#1)

- Tạo Server Action `syncArticleTitle(slug, title)` ở cả web/admin: gọi
  `notion.update(root theo slug)` + `roadmap.updateNode(node theo slug)`.
- Điểm ghi: `DocumentView` (đổi title notion) và builder `updateNode` (đổi title node)
  cùng route qua action này. Guard chống loop: chỉ ghi phía đối diện, không phát lại.
- Test: đổi title 2 phía, kiểm tra bên kia cập nhật; sửa liên tục không loop.

### Phase 4 — Sidebar notion ↔ canvas node (#3, lớn nhất)

Phụ thuộc QĐ-1 (A1). Việc:

- Auto-create root doc chuyển sang gắn với **chapter** slug (không phải article).
- `handleCreateChild`: sau khi tạo Document con, gọi Server Action tạo **article node**
  con (`parentId = chapter node`, `slug = doc.slug`, `articleType="notion"`,
  `positionX/Y` tự tính trên canvas).
- Set `slug` cho mọi child doc mới (hiện `create` để null) để giữ join key.
- Archive/remove doc → xử lý node tương ứng (remove khỏi canvas hay xoá node — cần
  chốt cùng #3).
- Cấm thêm page sâu > 1 cấp trong sidebar (giữ leaf rule) hoặc map cấp sâu sang cảnh
  báo.
- Test: thêm page trong sidebar → article node xuất hiện trên canvas, đúng cha; xoá
  page → node đồng bộ.

### Phase 5 — role/skill node = roadmap (#4)

Phụ thuộc QĐ-3. Việc:

- Khi tạo role node (top-level) trên canvas → Server Action gọi `createRoadmap`
  (`slug = node.slug`, `title = node.title`).
- Bảng quản lý roadmap đọc lại list → tự thấy roadmap mới (đã là `force-dynamic`).
- Xoá role node → chốt: xoá luôn roadmap hay chỉ gỡ node.
- Test: kéo role node vào canvas → roadmap mới hiện ở bảng quản lý.

## Rủi ro / lưu ý

- **2 store, không transaction chung.** Mọi sync (title, node↔doc, node↔roadmap) là
  best-effort, eventual-consistency. Chấp nhận drift hiếm; đừng cố 2-phase-commit.
- **Hướng phụ thuộc.** Cross-service call phải ở app (Server Action), không nhét vào
  `packages/core` service.
- **Mock mode.** Khi `NEXT_PUBLIC_SVC_API_URL` trống, roadmap là localStorage —
  sync node↔doc chỉ chạy phía client, không bền. Chốt: #3/#4 chỉ hỗ trợ chế độ backend
  thật, hay cả mock?
- Phase 1-2 độc lập, làm ngay được. Phase 3-5 chờ QĐ-1/2/3.
