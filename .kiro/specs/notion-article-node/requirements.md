# Requirements Document

## Introduction

Tính năng này kết nối chặt chẽ hai hệ thống đã tồn tại trong codebase: **Roadmap Canvas** (builder) và **Notion Workspace** (block editor). Mục tiêu là biến mỗi `article` node có `articleType = "notion"` trên canvas thành một cổng trực tiếp vào một Notion page đầy đủ chức năng.

Hiện tại, double-click vào một article notion node trên canvas mở `NodeDetailDialog`, sau đó user phải bấm "Điều hướng" để đến trang `/notion/{slug}`. Tính năng mới giữ nguyên luồng này (double-click → `NodeDetailDialog` → "Điều hướng") nhưng đảm bảo điều hướng đến đúng URL `/notion/{parentChapterSlug}?page={articleSlug}` thay vì chỉ `/notion/{slug}`, và tự động mở workspace đúng trang. Ngoài ra, việc **tạo một article notion node** trên canvas sẽ tự động tạo một `Document` mới trong Prisma và mở workspace ngay, thay vì để node ở trạng thái "chưa liên kết". Cuối cùng, **tạo một trang mới trong sidebar của Notion page** sẽ tự động tạo một child article node liên kết trên canvas — hành vi ngược lại.

Ngoài ra, tính năng mở rộng scope bao gồm: **click "Điều hướng" trên chapter node** sẽ điều hướng vào trang roadmap detail của chapter đó (sidebar trái/phải, canvas nối từ cha xuống các node con), và **thêm node role/skill mới trên canvas** sẽ tự động tạo một roadmap mới tương ứng trong bảng quản lý roadmap.

Phạm vi spec này bao gồm: luồng điều hướng khi click node, luồng điều hướng chapter vào roadmap detail, luồng tạo node → tạo Document, luồng tạo Document → tạo child node, đồng bộ title hai chiều, tạo roadmap tự động khi thêm role/skill node, và trải nghiệm người dùng trong cả hai zone (admin editor + web viewer).

## Glossary

- **Article_Notion_Node**: `RoadmapNode` có `nodeType = "article"` và `articleType = "notion"`.
- **Chapter_Node**: `RoadmapNode` có `nodeType = "chapter"` — đại diện cho một chương học (ví dụ: "Nhập môn HTML"). Click "Điều hướng" trên chapter node sẽ vào roadmap detail page của chương đó.
- **Role_Skill_Node**: `RoadmapNode` có `nodeType = "role"` hoặc `nodeType = "skill"` — đại diện cho một roadmap/lộ trình học. Thêm mới trên canvas sẽ tự động tạo roadmap mới tương ứng.
- **Notion_Page**: Một `Document` trong Prisma, biểu thị bởi `NotionDoc` trên client.
- **Notion_Workspace**: Component `NotionWorkspace` — editor đầy đủ với sidebar cây trang, block editor, slash commands, drag & drop blocks.
- **Root_Doc**: `NotionDoc` có `slug` khớp với `slug` của chapter node cha — là gốc của cây trang Notion cho một chapter.
- **Article_Doc**: `NotionDoc` là trang top-level con của `Root_Doc`, có `slug` khớp với `slug` của `Article_Notion_Node`. Ví dụ: chapter "Nhập môn HTML" là `Root_Doc`, còn "HTML cơ bản" là `Article_Doc` con của nó — trong sidebar Notion sẽ thể hiện dạng tree cha/con: `Nhập môn HTML → HTML cơ bản`.
- **Child_Doc**: `NotionDoc` có `parentDocumentId` trỏ đến một `Article_Doc` — trang con trong cây Notion, **không** có node tương ứng trên canvas.
- **Roadmap_Detail_Page**: Trang chi tiết của một chapter/role/skill node — UI gồm sidebar trái (danh sách node), sidebar phải (properties), và canvas trung tâm hiển thị các node con kết nối từ node cha.
- **Canvas**: React Flow canvas trong `BuilderCanvas`.
- **Builder**: Giao diện admin tại `apps/admin`, nơi admin có thể chỉnh sửa roadmap và Notion pages.
- **Viewer**: Giao diện web tại `apps/web`, nơi học viên xem nội dung đã xuất bản (read-only).
- **NotionService**: Server-side service `packages/core/src/notion/notion.service.ts`.
- **RoadmapService**: Domain service xử lý CRUD nodes trên roadmap.
- **Slug**: Chuỗi định danh URL-safe, bất biến sau khi tạo, là join key giữa `RoadmapNode.slug` và `Document.slug`.
- **canEdit**: Prop boolean truyền vào `NotionWorkspace` — `true` trên admin zone (admin/super-admin), `false` trên web zone (viewer/guest).
- **notionPageId**: Trường `RoadmapNode.notionPageId` lưu `Document.id` của `Article_Doc` liên kết. Đây là foreign key dùng để: (1) lookup `Document` khi điều hướng từ canvas sang Notion page, (2) sync title hai chiều giữa node và Document, (3) sync trạng thái `isPublished` giữa node và Document. Khi `notionPageId = null`, node chưa được liên kết với bất kỳ Notion page nào.

---

## Requirements

### Requirement 1: Double-click vào Article Notion Node → NodeDetailDialog → Điều hướng đến Notion Workspace

**User Story:** Là một admin, tôi muốn double-click vào article notion node trên canvas để mở `NodeDetailDialog`, sau đó workspace Notion tự động mở ngay mà không cần thêm thao tác nào, để tôi truy cập nhanh vào nội dung của node đó.

#### Acceptance Criteria

1. WHEN admin double-click vào `Article_Notion_Node` trên canvas, THE `BuilderCanvas` SHALL mở `NodeDetailDialog` (sidebar phải) — hành vi này giống với tất cả node khác.
2. WHEN `NodeDetailDialog` mở cho `Article_Notion_Node` có `notionPageId` hợp lệ, THE dialog SHALL tự động điều hướng đến URL `/notion/{parentChapterSlug}?page={articleSlug}` trong cùng tab ngay khi dialog mở — sidebar hiển thị là visual feedback trước khi điều hướng, không yêu cầu admin click thêm nút nào.
3. WHEN `NodeDetailDialog` mở cho `Article_Notion_Node` có `notionPageId = null`, THE dialog SHALL hiển thị nút "Điều hướng" ở trạng thái disabled và khi click SHALL hiển thị toast "Trang Notion chưa được tạo cho node này" thay vì điều hướng.
4. WHEN admin double-click vào bất kỳ node nào khác (role/skill/chapter/article-jupyter), THE `NodeDetailDialog` SHALL mở như hành vi hiện tại cho Điều hướng, Chỉnh sửa, Xóa khỏi Canvas.

---

### Requirement 2: Tạo Article Notion Node → Tự động tạo Notion Document

**User Story:** Là một admin, tôi muốn việc tạo một article notion node trên canvas tự động tạo Notion page mới, để tôi không cần tạo trang thủ công và liên kết slug sau.

#### Acceptance Criteria

1. WHEN admin chọn tạo một node mới với `nodeType = "article"` và `articleType = "notion"` trên canvas với title có độ dài 1–200 ký tự, THE `BuilderCanvas` SHALL gọi Server Action tạo một `Document` mới với `slug` bằng `slug` của node mới được tạo và `title` bằng title đã nhập.
2. WHEN `Document` được tạo thành công, THE `BuilderCanvas` SHALL cập nhật `RoadmapNode.notionPageId` bằng `Document.id` trả về.
3. WHEN cả node và `Document` đều được tạo thành công, THE `BuilderCanvas` SHALL tự động điều hướng đến URL `/notion/{parentChapterSlug}?page={articleSlug}` để admin có thể bắt đầu soạn thảo ngay lập tức.
4. IF `Document` tạo thất bại (lỗi mạng, lỗi Prisma), THEN THE `BuilderCanvas` SHALL hiển thị toast lỗi "Không thể tạo trang Notion. Node đã được tạo nhưng chưa được liên kết." và node sẽ ở trạng thái `notionPageId = null`.
5. IF `Document` tạo thành công nhưng việc cập nhật `notionPageId` lên node thất bại, THEN THE `BuilderCanvas` SHALL hiển thị toast lỗi và log các trường `{ nodeId, documentId, slug }` để admin có thể liên kết thủ công.
6. WHEN admin tạo một `Article_Notion_Node` mà `parentChapterSlug` không xác định được (node không có parent chapter node trong graph), THE `BuilderCanvas` SHALL vẫn tạo `Document` bình thường nhưng KHÔNG tự động điều hướng.
7. IF `RoadmapNode` tạo thất bại, THEN THE `BuilderCanvas` SHALL hiển thị toast lỗi và KHÔNG gọi Server Action tạo `Document` — không để `Document` mồ côi không có node.

---

### Requirement 3: Title của Article Notion Node đồng bộ với Title của Notion Page

**User Story:** Là một admin, tôi muốn title của article notion node trên canvas luôn phản ánh title của Notion page tương ứng, để canvas và workspace nhất quán.

#### Acceptance Criteria

1. WHEN admin chỉnh sửa title của `Article_Notion_Node` trong `NodeEditPanel` và lưu, THE `RoadmapService` SHALL cập nhật `RoadmapNode.title` trước, sau đó THE `NotionService` SHALL cập nhật `Document.title` của `Article_Doc` có `slug` khớp với `RoadmapNode.slug`.
2. WHEN admin chỉnh sửa title của `Article_Doc` trong Notion Workspace (block editor) và debounce 500ms hoàn thành, THE `NotionWorkspace` SHALL gọi `syncNodeTitle(slug, newTitle)` để cập nhật `RoadmapNode.title` khớp với `slug`.
3. IF `Document` không tìm thấy theo `slug` khi sync canvas → Notion, THEN THE `RoadmapService` SHALL ghi log warning và bỏ qua, KHÔNG ném lỗi về UI — `RoadmapNode.title` vẫn được lưu.
4. IF `RoadmapNode` không tìm thấy theo `slug` khi sync Notion → canvas, THEN THE `NotionWorkspace` SHALL bỏ qua silently, không hiển thị lỗi cho user.
5. IF `NotionService` ghi `Document.title` thất bại (lỗi mạng/Prisma) sau khi `RoadmapNode.title` đã được lưu, THEN THE `NodeEditPanel` SHALL hiển thị toast warning "Đã lưu tên node nhưng không thể đồng bộ với Notion page." — không rollback `RoadmapNode.title`.

---

### Requirement 4: Tạo trang mới trong Sidebar Notion = Tạo Node trên Canvas liên kết với Node Cha tương ứng

**User Story:** Là một admin, tôi muốn tạo một trang mới trong sidebar Notion workspace sẽ tự động tạo node trên canvas liên kết với node cha tương ứng, để cấu trúc canvas phản ánh cấu trúc tài liệu ở mọi cấp độ.

Ví dụ cụ thể: Đang ở Notion page của chapter "Nhập môn HTML" — sidebar Notion hiển thị tree `Nhập môn HTML (Root_Doc) → HTML cơ bản (Article_Doc) → ...`. Khi admin click "Trang mới" dưới `Root_Doc` (chapter node là cha), hệ thống tạo `Article_Doc` mới (ví dụ: "CSS cơ bản") và đồng thời tạo `Article_Notion_Node` mới trên canvas với `parentId` là chapter node "Nhập môn HTML". Nếu admin tạo sub-page dưới "HTML cơ bản" (`Article_Doc`), hệ thống tạo `Child_Doc` mới và đồng thời tạo node mới trên canvas với `parentId` là node "HTML cơ bản" — nếu tìm được node tương ứng qua slug.

#### Acceptance Criteria

1. WHEN admin click "Trang mới" trong sidebar của `NotionWorkspace`, THE `NotionWorkspace` SHALL xác định node cha tương ứng trên canvas theo quy tắc: nếu trang cha là `Root_Doc` (chapter node), `parentId` = chapter node id; nếu trang cha là `Article_Doc`, `parentId` = article node id (tra cứu qua `slug` của `Article_Doc`).
2. WHEN node cha tương ứng xác định được, THE `NotionWorkspace` SHALL tạo node mới trên canvas với `parentId` trỏ đến node cha đó TRƯỚC — chỉ sau khi node tạo thành công mới tiếp tục tạo `Document`.
3. WHEN node mới được tạo thành công, THE `NotionWorkspace` SHALL nhận về `slug` từ phản hồi tạo node và tạo `Document` với `slug` bằng `slug` đó (đảm bảo join key đồng nhất).
4. WHEN trang cha là `Child_Doc` (không có node tương ứng trên canvas), THE `NotionWorkspace` SHALL chỉ tạo `Document` mới — KHÔNG tạo node trên canvas.
5. IF node cha tương ứng không tìm thấy trên canvas (slug không khớp hoặc node đã bị xóa), THEN THE `NotionWorkspace` SHALL chỉ tạo `Document` mới và KHÔNG tạo node — không để hệ thống ở trạng thái không nhất quán.
6. IF node tạo thất bại, THEN THE `NotionWorkspace` SHALL hiển thị toast lỗi và KHÔNG gọi tạo `Document` — không để Document mồ côi.
7. IF `Document` tạo thất bại sau khi node đã tạo thành công, THEN THE `NotionWorkspace` SHALL xóa node vừa tạo, hiển thị toast lỗi "Không thể tạo trang Notion. Đã hủy tạo node."
8. WHERE `roadmapChapterSlug` không được truyền vào `NotionWorkspace` (web viewer zone), THE `NotionWorkspace` SHALL chỉ tạo `Document` mà không tạo node.
9. WHERE `roadmapBackendEnabled()` trả về `false` (mock/localStorage mode), THE `NotionWorkspace` SHALL chỉ tạo `Document` mà không tạo node.

---

### Requirement 5: Notion Workspace mở đúng Document khi điều hướng từ Canvas

**User Story:** Là một admin, tôi muốn khi điều hướng từ canvas đến Notion workspace, trang Notion của article node được chọn sẵn trong sidebar và hiển thị ngay, để tôi không cần tìm trang trong cây sidebar.

#### Acceptance Criteria

1. WHEN `NotionWorkspace` nhận `initialSelectedId` khớp với `id` của một `NotionDoc`, THE `NotionWorkspace` SHALL render nội dung `Document` đó trong vùng editor mà không yêu cầu user click, và SHALL highlight + scroll-into-view item tương ứng trong sidebar.
2. WHEN URL chứa query param `?page={articleSlug}`, THE admin page handling `NotionWorkspace` SHALL resolve `articleSlug` thành `Document.id` ở server side trước khi render và truyền vào `initialSelectedId`.
3. IF `articleSlug` không tìm thấy trong database (Document bị xóa hoặc slug sai), THEN THE admin page SHALL fallback về hiển thị `Root_Doc`. IF `Root_Doc` cũng không tìm thấy, THEN THE admin page SHALL hiển thị trang trống với thông báo "Không tìm thấy trang" — không render lỗi 404 HTTP.
4. WHILE `Document` đang được load sau khi `initialSelectedId` thay đổi, THE `NotionWorkspace` SHALL hiển thị skeleton loading state trong vùng editor; skeleton SHALL ẩn đi khi `Document` đã sẵn sàng để hiển thị.

---

### Requirement 6: Viewer Zone — Hiển thị Article Notion Node Read-Only

**User Story:** Là một học viên, tôi muốn click vào article notion node trong roadmap viewer để đọc nội dung Notion page đã xuất bản, mà không thấy UI chỉnh sửa.

#### Acceptance Criteria

1. WHEN học viên click vào `Article_Notion_Node` trong `ViewerCanvas`, THE `ViewerCanvas` SHALL điều hướng đến URL `/notion/{parentChapterSlug}?page={articleSlug}` trên `apps/web` (web zone, read-only).
2. IF `Article_Notion_Node` có `notionPageId = null` trong viewer zone, THEN THE `ViewerCanvas` SHALL render node ở trạng thái không thể click (pointer-events disabled) và với visual style phân biệt (opacity giảm hoặc icon khóa), không hiển thị link/button điều hướng.
3. WHILE `NotionWorkspace` được render trên web zone với `canEdit = false`, THE `NotionWorkspace` SHALL ẩn toàn bộ affordance chỉnh sửa: nút "Trang mới", "Thùng rác", context menu archive/delete, block editor toolbar, và bất kỳ control nào cho phép thêm/xóa/sửa nội dung block.
4. WHILE `NotionWorkspace` được render trên web zone với `canEdit = false`, THE `NotionWorkspace` SHALL chỉ load và hiển thị các `Document` có `isPublished = true` và `isArchived = false`.
5. IF `articleSlug` từ URL không khớp với bất kỳ `Document` nào có `isPublished = true` và `isArchived = false`, THEN THE web page SHALL hiển thị trang thông báo "Nội dung không khả dụng" và KHÔNG hiển thị nội dung Document khác.

---

### Requirement 7: Đồng bộ trạng thái xuất bản — Article Node và Notion Document nhất quán

**User Story:** Là một admin, tôi muốn khi xuất bản roadmap, các Notion pages liên kết với article nodes cũng được xuất bản đồng thời, để học viên thấy nội dung đầy đủ.

#### Acceptance Criteria

1. WHEN admin toggle "xuất bản" cho một `Article_Notion_Node` trong `NodeEditPanel` thành `isPublished = true`, THE `NodeEditPanel` SHALL lưu `RoadmapNode.isPublished = true` trước, sau đó gọi Server Action để set `Document.isPublished = true` cho `Article_Doc` có `notionPageId` khớp.
2. WHEN admin toggle "xuất bản" thành `isPublished = false`, THE `NodeEditPanel` SHALL lưu `RoadmapNode.isPublished = false` trước, sau đó set `Document.isPublished = false`.
3. IF `notionPageId = null` hoặc `Document` không tìm thấy theo `notionPageId`, THEN THE `NodeEditPanel` SHALL vẫn hoàn thành việc lưu `RoadmapNode.isPublished` và bỏ qua bước sync Document — không chặn user.
4. IF Server Action cập nhật `Document.isPublished` thất bại, THEN THE `NodeEditPanel` SHALL hiển thị toast warning "Đã lưu trạng thái xuất bản nhưng không thể đồng bộ với Notion page." — `RoadmapNode.isPublished` giữ nguyên, không rollback.
5. WHERE `roadmapBackendEnabled()` trả về `false` (mock mode), THE `NodeEditPanel` SHALL bỏ qua publish sync (không gọi Server Action).

---

### Requirement 8: Xóa Article Notion Node — Giữ nguyên Notion Document

**User Story:** Là một admin, tôi muốn xóa một article notion node khỏi canvas mà không mất nội dung Notion page, để tôi có thể tái sử dụng page sau này.

#### Acceptance Criteria

1. WHEN admin xóa một `Article_Notion_Node` khỏi canvas ("Xóa khỏi Canvas" trong `NodeDetailDialog`), THE `BuilderCanvas` SHALL chỉ xóa node khỏi canvas và KHÔNG thay đổi trạng thái của `Document` liên kết (isArchived, isDeleted giữ nguyên).
2. WHEN admin xóa vĩnh viễn một `Article_Notion_Node` qua `NodeSidebar`, THE `NodeSidebar` SHALL xóa node khỏi hệ thống trước (node không còn truy vấn được), sau đó archive `Document` liên kết (set `isArchived = true`) và hiển thị xác nhận thành công cho admin.
3. IF `RoadmapNode` xóa thất bại, THEN THE `NodeSidebar` SHALL hiển thị toast lỗi và KHÔNG archive `Document` — không thay đổi trạng thái Document khi node chưa được xóa.
4. IF archive `Document` thất bại sau khi node đã xóa thành công, THEN THE `NodeSidebar` SHALL vẫn hoàn thành thao tác xóa node, ghi log lỗi có thể kiểm tra được trong system log, và hiển thị toast warning cho admin "Node đã xóa nhưng không thể archive Notion page."

---

### Requirement 9: Parser và Serializer — Slug Round-Trip

**User Story:** Là một developer, tôi muốn đảm bảo slug được generate, lưu, và resolve nhất quán xuyên suốt hệ thống, để tránh broken links giữa canvas và Notion workspace.

#### Acceptance Criteria

1. THE `Slug_Generator` SHALL tạo slug từ title theo quy tắc: lowercase, strip dấu Unicode/tiếng Việt về ASCII, dấu cách thành `-`, loại bỏ ký tự đặc biệt (non-alphanumeric, non-hyphen), chuẩn hóa nhiều dấu `-` liên tiếp thành một, loại bỏ `-` ở đầu/cuối, cắt tối đa 100 ký tự. Nếu title rỗng hoặc chỉ chứa ký tự đặc biệt, slug mặc định là `"untitled"`.
2. WHEN một slug đã tồn tại trong cùng roadmap (`RoadmapNode.slug`) hoặc trong `Document.slug` (globally), THE `Slug_Generator` SHALL thêm suffix `-{n}` (n từ 2 đến tối đa 999) để đảm bảo uniqueness.
3. THE `Slug_Generator` SHALL đảm bảo `RoadmapNode.slug` bằng `Document.slug` của `Article_Doc` tương ứng tại thời điểm tạo và tại mọi lần đọc lại sau đó (round-trip: slug không thay đổi khi lưu và đọc lại).
4. WHEN `?page={slug}` được parse từ URL, THE page resolver SHALL lookup `Document` theo `slug` và trả về `Document.id` — `parse(slug)` → `Document.id` → `getById(id)` SHALL cho ra đúng `Document` đó.
5. THE `Slug_Generator` SHALL KHÔNG cập nhật slug khi title thay đổi — slug là bất biến sau khi tạo.

---

### Requirement 10: Click "Điều hướng" trên Chapter Node → Roadmap Detail Page

**User Story:** Là một admin, tôi muốn click "Điều hướng" trên chapter node để vào trang roadmap detail của chương đó, với giao diện sidebar trái/phải và canvas hiển thị các node con, để tôi có thể quản lý nội dung của chương một cách trực quan.

Ví dụ cụ thể: Chapter node "Nhập môn HTML" → click "Điều hướng" → vào `Roadmap_Detail_Page` của "Nhập môn HTML" — sidebar trái hiển thị danh sách node con (HTML cơ bản, CSS cơ bản,...), canvas trung tâm hiển thị các article node liên kết từ chapter node cha xuống các con, sidebar phải hiển thị properties của node được chọn.

#### Acceptance Criteria

1. WHEN admin click "Điều hướng" trên `Chapter_Node` trong `NodeDetailDialog`, THE `BuilderCanvas` SHALL điều hướng đến `Roadmap_Detail_Page` của chapter đó với URL `/builder/{roadmapSlug}/chapter/{chapterSlug}`.
2. WHEN `Roadmap_Detail_Page` của một chapter được load, THE page SHALL hiển thị canvas React Flow chỉ với các node con trực tiếp (`parentId = Chapter_Node.id`, depth=1) của `Chapter_Node` đó, kết nối từ chapter node cha xuống các node con. IF chapter không có node con nào, THE canvas SHALL hiển thị trạng thái rỗng.
3. WHEN `Roadmap_Detail_Page` của một chapter được load, THE page SHALL hiển thị sidebar trái liệt kê các node có `parentId = Chapter_Node.id` và sidebar phải hiển thị properties của node được chọn; IF không có node nào được chọn, sidebar phải hiển thị trạng thái rỗng.
4. WHEN admin click vào một `Article_Notion_Node` trong canvas của `Roadmap_Detail_Page`, THE page SHALL áp dụng hành vi double-click theo Requirement 1.
5. WHEN admin double-click vào `Article_Notion_Node` trong canvas của `Roadmap_Detail_Page`, THE page SHALL mở `NodeDetailDialog` và tự động điều hướng đến Notion workspace theo Requirement 1.
6. IF `Chapter_Node.slug` là empty string hoặc null tại thời điểm click "Điều hướng", THEN THE `BuilderCanvas` SHALL hiển thị toast lỗi "Không thể điều hướng đến chapter này" và không điều hướng.
7. IF URL `/builder/{roadmapSlug}/chapter/{chapterSlug}` được load nhưng `chapterSlug` không tìm thấy trong database, THEN THE page SHALL hiển thị thông báo lỗi với link quay về trang roadmap builder cha.

---

### Requirement 11: Thêm Role/Skill Node trên Canvas = Tạo Roadmap Mới Tự Động

**User Story:** Là một admin, tôi muốn việc thêm một node role hoặc skill mới trên canvas tự động tạo một roadmap mới tương ứng trong bảng quản lý roadmap, để tôi không cần tạo roadmap thủ công và sau đó liên kết với node.

#### Acceptance Criteria

1. WHEN admin thêm một node mới với `nodeType = "role"` hoặc `nodeType = "skill"` trên canvas, THE `BuilderCanvas` SHALL gọi Server Action tạo một `Roadmap` mới với `title` bằng title của node và `slug` được generate theo quy tắc Requirement 9 (lowercase, spaces→hyphens, max 100 chars).
2. WHEN `Roadmap` được tạo thành công, THE `BuilderCanvas` SHALL cập nhật `RoadmapNode.linkedRoadmapId` bằng `Roadmap.id` trả về để liên kết node với roadmap mới.
3. WHEN `Roadmap` được tạo thành công, THE `RoadmapListPage` SHALL hiển thị roadmap mới này trong danh sách khi admin truy cập hoặc làm mới trang.
4. IF `Roadmap` tạo thất bại (lỗi mạng, lỗi Prisma), THEN THE `BuilderCanvas` SHALL hiển thị toast lỗi "Không thể tạo roadmap. Node đã được tạo nhưng chưa được liên kết với roadmap." và node ở trạng thái `linkedRoadmapId = null` trên canvas — admin có thể retry qua node context menu.
5. WHEN admin click "Điều hướng" trên `Role_Skill_Node` có `linkedRoadmapId` là non-null string, THE `BuilderCanvas` SHALL điều hướng đến `Roadmap_Detail_Page` của roadmap được liên kết.
6. WHEN admin click "Điều hướng" trên `Role_Skill_Node` có `linkedRoadmapId = null`, THE `BuilderCanvas` SHALL hiển thị toast cảnh báo "Node này chưa được liên kết với roadmap nào."
7. THE `Roadmap` được tạo tự động SHALL có `isPublished = false` mặc định, cho đến khi admin xuất bản thủ công.
8. WHEN `slug` của `Roadmap` mới trùng với slug đã tồn tại, THE `Slug_Generator` SHALL thêm suffix `-{n}` (n từ 2 đến 999) để đảm bảo uniqueness trước khi lưu.

---

### Requirement 12: Block Types được hỗ trợ trong Notion Editor

**User Story:** Là một admin, tôi muốn Notion editor hỗ trợ đầy đủ các loại block phổ biến — từ văn bản, media, đến slash command và drag & drop — để tôi có thể soạn thảo nội dung phong phú mà không cần rời khỏi workspace.

#### Acceptance Criteria

**Văn bản cơ bản:**

1. THE `NotionWorkspace` SHALL hỗ trợ block loại `paragraph` (text thường, mặc định khi tạo block mới).
2. THE `NotionWorkspace` SHALL hỗ trợ block loại `heading_1`, `heading_2`, `heading_3` với visual phân cấp rõ ràng.
3. THE `NotionWorkspace` SHALL hỗ trợ block loại `bulleted_list` (danh sách dấu chấm), `numbered_list` (danh sách đánh số), và `todo` (checkbox với trạng thái checked/unchecked).
4. THE `NotionWorkspace` SHALL hỗ trợ block loại `quote` (trích dẫn với visual indent trái) và `divider` (đường kẻ ngang phân tách nội dung).

**Tổ chức nội dung:**

5. THE `NotionWorkspace` SHALL hỗ trợ block loại `toggle` — nội dung bên trong có thể thu gọn hoặc mở rộng bằng click vào icon toggle.
6. THE `NotionWorkspace` SHALL hỗ trợ block loại `callout` — khung nhấn mạnh với icon emoji tuỳ chỉnh và nền màu phân biệt.
7. THE `NotionWorkspace` SHALL hỗ trợ block loại `columns` với 2 hoặc 3 cột song song — mỗi cột là một vùng editor độc lập có thể chứa bất kỳ loại block nào.

**Media & Rich content:**

8. THE `NotionWorkspace` SHALL hỗ trợ block loại `image` — chèn ảnh từ file upload hoặc URL, hiển thị inline trong editor.
9. THE `NotionWorkspace` SHALL hỗ trợ block loại `video` — embed hoặc upload video, hiển thị player inline.
10. THE `NotionWorkspace` SHALL hỗ trợ block loại `audio` — embed hoặc upload audio, hiển thị player inline.
11. THE `NotionWorkspace` SHALL hỗ trợ block loại `file` — đính kèm file bất kỳ, hiển thị tên file và nút download.
12. THE `NotionWorkspace` SHALL hỗ trợ block loại `embed` — nhúng nội dung từ URL bên ngoài (YouTube, Figma, Google Drive, v.v.) qua iframe hoặc link preview.
13. THE `NotionWorkspace` SHALL hỗ trợ block loại `code` — hiển thị code với syntax highlighting theo ngôn ngữ lập trình được chọn, hỗ trợ tối thiểu: JavaScript, TypeScript, Python, HTML, CSS, SQL, JSON, Bash.

**Liên kết & tham chiếu:**

14. THE `NotionWorkspace` SHALL hỗ trợ `mention` — gõ `@` để mention trang (`@page`) hoặc ngày (`@date`), hiển thị inline chip có thể click.
15. THE `NotionWorkspace` SHALL hỗ trợ block loại `link_to_page` — liên kết nội bộ đến một `Document` khác trong hệ thống, hiển thị tên trang và icon.

**Thao tác với blocks:**

16. WHEN admin kéo block từ vị trí này sang vị trí khác trong cùng trang, THE `NotionWorkspace` SHALL cho phép reorder blocks qua drag & drop với visual indicator vị trí thả.
17. WHEN admin chọn một block và đổi loại (transform), THE `NotionWorkspace` SHALL chuyển đổi block sang loại mới (ví dụ: `paragraph` ↔ `heading_1` ↔ `todo` ↔ `bulleted_list`) mà không mất nội dung text hiện có.
18. WHEN admin nhấn `Tab` trên list block (`bulleted_list`, `numbered_list`, `todo`), THE `NotionWorkspace` SHALL indent block thành nested item; WHEN admin nhấn `Shift+Tab`, THE `NotionWorkspace` SHALL outdent block lên một cấp.
19. WHEN admin gõ `/` trong editor, THE `NotionWorkspace` SHALL hiển thị slash command menu liệt kê tất cả loại block được hỗ trợ, lọc theo ký tự gõ tiếp theo, và tạo block tương ứng khi admin chọn.
