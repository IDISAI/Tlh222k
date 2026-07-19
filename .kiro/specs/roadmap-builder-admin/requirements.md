# Requirements Document

> ⚠️ **SUPERSEDED một phần (2026-07-19, nhánh `hf/roadmap`).** Các phần đã đảo: **Disabled_Node** và **"Xóa khỏi Canvas"** đã gỡ hẳn — xóa node là vĩnh viễn, node đã xóa không render trên canvas (`roadmapGraphById` lọc `isDeleted`). Kéo node lạ từ sidebar = **move** (không clone). Node role/skill = roadmap (detail = rooted view `?node={id}`). Nguồn chuẩn: `CLAUDE.md` mục "Roadmap builder model". Doc dưới giữ làm lịch sử.

## Introduction

Tính năng **Roadmap Builder Admin** cho phép admin và super-admin tạo, chỉnh sửa và quản lý roadmap trực tiếp trên canvas ReactFlow trong `apps/admin`. Roadmap được cấu trúc theo 4 cấp node phân cấp (role → skill → chapter → article), hỗ trợ kéo-thả từ sidebar, hover preview, điều hướng đến trang chi tiết, và yêu cầu tải lại trang để xem cập nhật mới nhất sau khi admin lưu.

Toàn bộ giao tiếp giữa Frontend và Backend sử dụng GraphQL (Apollo Client + codegen). Tính năng này mở rộng domain logic hiện có tại `packages/core/src/roadmap` và không làm thay đổi hành vi của `apps/web` đối với viewer.

---

## Glossary

- **Admin_App**: Ứng dụng Next.js tại `apps/admin`, giao diện quản trị dành cho admin và super-admin.
- **Web_App**: Ứng dụng Next.js tại `apps/web`, giao diện dành cho viewer/user cuối.
- **Canvas**: Vùng làm việc ReactFlow trong Admin_App nơi admin xây dựng cấu trúc roadmap bằng cách thêm và kết nối các node.
- **Node**: Một đơn vị nội dung trong roadmap, có một trong bốn loại: `role`, `skill`, `chapter`, `article`.
- **NodeType**: Kiểu phân loại node, một trong `role | skill | chapter | article`. Thứ tự phân cấp: role (cấp 1, cao nhất) → skill (cấp 2) → chapter (cấp 3) → article (cấp 4, thấp nhất).
- **Sidebar**: Panel bên phải trong Admin_App (dùng shadcn Sheet/Drawer) hiển thị danh sách các node đã tồn tại trong hệ thống, phân loại theo NodeType với màu sắc/icon phân biệt rõ ràng giữa các loại.
- **NodeSelector_Modal**: Modal xuất hiện khi admin click chuột phải trên Canvas, cho phép chọn NodeType và thông tin để tạo node mới.
- **NodeDetail_Dialog**: Dialog hiển thị khi admin double-click vào một node trên Canvas, chứa thông tin chi tiết của node và ba nút hành động: Chỉnh sửa, Xóa, Điều hướng.
- **Hover_Preview**: Tooltip/popover hiển thị thông tin tóm tắt của một node khi người dùng hover chuột vào node đó trên Canvas.
- **Graph_Preview**: Panel nhỏ hiển thị cấu trúc ReactFlow bên trong một node `role` hoặc `skill` khi hover, cho thấy các node con.
- **Article_Node**: Node có NodeType `article`. Có hai loại con: `notion` (liên kết đến trang Notion) và `jupyter` (liên kết đến trang Jupyter Notebook).
- **Disabled_Node**: Node trên Canvas đã bị xóa khỏi Sidebar (xóa vĩnh viễn khỏi hệ thống) — hiển thị dạng mờ/disabled, không thể tương tác cho đến khi admin xóa riêng trên Canvas.
- **RoadmapService**: Service tại `packages/core/src/roadmap/roadmap.service.ts` cung cấp dữ liệu roadmap cho cả hai app.
- **GraphQL_API**: Tầng giao tiếp giữa FE và BE sử dụng Apollo Client + GraphQL Codegen. Toàn bộ thao tác CRUD roadmap/node đều thực hiện qua GraphQL mutation/query — không dùng REST API.
- **Admin**: Người dùng có Clerk role `admin`.
- **Super_Admin**: Người dùng có Clerk role `super-admin`.
- **Viewer**: Người dùng có Clerk role `viewer` hoặc chưa xác thực — không có quyền chỉnh sửa roadmap.
- **UserRole**: Kiểu phân quyền, một trong `viewer | admin | super-admin` (đã có trong `@workspace/core`).
- **Toast**: Thông báo ngắn dùng shadcn `toast` component — tất cả thông báo hệ thống (thành công, lỗi, cảnh báo) đều hiển thị bằng toast, nội dung luôn bằng tiếng Việt.

---

## Requirements

### Requirement 1: Phân quyền CRUD roadmap

**User Story:** Là một admin hoặc super-admin, tôi muốn có quyền tạo, đọc, cập nhật và xóa roadmap, để tôi có thể quản lý nội dung học tập cho người dùng.

#### Acceptance Criteria

1. WHEN người dùng có UserRole là `admin` hoặc `super-admin` truy cập trang builder trong Admin_App, THE Admin_App SHALL hiển thị đầy đủ Canvas, Sidebar và các điều khiển CRUD (nút Tạo roadmap, Lưu, Xóa roadmap).
2. WHEN người dùng có UserRole là `viewer` cố truy cập trang builder trong Admin_App, THE Admin_App SHALL trả về HTTP 403, chuyển hướng đến trang thông báo không có quyền truy cập, và trang đó SHALL hiển thị nút "Về trang chủ" điều hướng đến Web_App.
3. WHEN người dùng chưa xác thực cố truy cập bất kỳ route nào trong Admin_App, THE Admin_App SHALL chuyển hướng đến trang đăng nhập Clerk và sau khi đăng nhập thành công quay lại URL ban đầu.
4. THE RoadmapService SHALL cung cấp các phương thức `createRoadmap`, `updateRoadmap`, `deleteRoadmap`, `createNode`, `updateNode`, `deleteNode` được gọi qua GraphQL mutation, trong đó mỗi phương thức SHALL nhận tham số `callerRole: UserRole` và kiểm tra quyền trước khi thực thi.
5. IF một yêu cầu ghi (create/update/delete) được gọi với `callerRole` là `viewer`, THEN THE RoadmapService SHALL từ chối yêu cầu, không thực thi thao tác, và trả về lỗi có mã `PERMISSION_DENIED`.
6. WHEN admin hoặc super-admin thực hiện thao tác xóa roadmap, THE Admin_App SHALL hiển thị dialog xác nhận với thông tin tên roadmap trước khi tiến hành xóa.
7. THE Admin_App SHALL sử dụng Apollo Client để gọi tất cả GraphQL mutation và query liên quan đến roadmap. THE GraphQL schema SHALL được generate tự động bằng GraphQL Codegen thành TypeScript types tại `packages/core/src/roadmap/graphql/`.

---

### Requirement 2: Cấu trúc 4 cấp node phân cấp

**User Story:** Là một admin, tôi muốn tổ chức nội dung roadmap theo 4 cấp node phân cấp (role → skill → chapter → article), để người dùng có thể tiếp cận nội dung theo lộ trình rõ ràng từ tổng quát đến chi tiết.

#### Acceptance Criteria

1. THE RoadmapService SHALL lưu trữ mỗi node với trường `nodeType` có giá trị một trong `role | skill | chapter | article`. IF `nodeType` nhận giá trị nằm ngoài tập hợp này, THEN THE RoadmapService SHALL từ chối thao tác và trả về lỗi `INVALID_NODE_TYPE`.
2. THE RoadmapService SHALL gán cấp phân cấp cho mỗi NodeType: `role` = cấp 1, `skill` = cấp 2, `chapter` = cấp 3, `article` = cấp 4.
3. WHEN admin tạo một node con từ một node cha trên Canvas, THE Canvas SHALL chỉ cho phép chọn NodeType có cấp bằng `cấp_cha + 1` (ví dụ: cha là `role` chỉ cho phép tạo con `skill`). IF node cha là `article`, THEN THE Canvas SHALL vô hiệu hóa tùy chọn tạo con và hiển thị toast cảnh báo "`article` là node lá, không thể có node con".
4. IF admin cố kết nối hai node mà cấp của source không bằng `cấp_target - 1`, THEN THE Canvas SHALL từ chối kết nối và hiển thị toast lỗi chỉ rõ cặp NodeType không hợp lệ (ví dụ: "Không thể kết nối `role` → `chapter`, cần qua `skill` trước").
5. THE RoadmapService SHALL cho phép node `role`, `skill`, và `chapter` chứa tối đa 100 node con trực tiếp. IF số node con vượt quá 100, THEN THE RoadmapService SHALL trả về lỗi `CHILDREN_LIMIT_EXCEEDED` và THE Admin_App SHALL hiển thị toast lỗi tương ứng bằng tiếng Việt.
6. THE RoadmapService SHALL đảm bảo node `article` không có node con. IF có yêu cầu tạo node con cho một node `article`, THEN THE RoadmapService SHALL từ chối và trả về lỗi `LEAF_NODE_CANNOT_HAVE_CHILDREN`.

---

### Requirement 3: Tạo và quản lý roadmap trên Canvas ReactFlow

**User Story:** Là một admin, tôi muốn tạo và chỉnh sửa cấu trúc roadmap trực tiếp trên canvas kéo-thả, để tôi có thể xây dựng lộ trình học tập một cách trực quan.

#### Acceptance Criteria

1. WHEN admin click chuột phải tại bất kỳ vị trí trống nào trên Canvas, THE Canvas SHALL hiển thị NodeSelector_Modal tại vị trí con trỏ với danh sách 4 NodeType để chọn.
2. WHEN admin chọn một NodeType trong NodeSelector_Modal, nhập tiêu đề (bắt buộc, tối đa 150 ký tự), và xác nhận, THE Canvas SHALL thêm node mới vào vị trí đã click với NodeType tương ứng. IF tiêu đề để trống, THEN THE NodeSelector_Modal SHALL hiển thị thông báo lỗi inline và không đóng modal.
3. WHILE một node đang được hiển thị trên Canvas, THE Canvas SHALL hỗ trợ đầy đủ các thao tác ReactFlow: di chuyển node (drag), zoom (Ctrl+scroll / trackpad pinch), pan (drag nền hoặc Space+drag), kết nối giữa các node (draw edge từ handle), xóa node và edge (Delete key hoặc context menu → "Xóa").
4. WHEN admin kéo một node từ Sidebar vào Canvas và thả, THE Canvas SHALL thêm node đó vào Canvas tại vị trí thả với trạng thái "được chọn" (selected=true) và hiển thị các connection handles sẵn sàng để kết nối. Đồng thời, THE Sidebar SHALL ẩn node đó khỏi danh sách trong phiên tạo roadmap hiện tại.
5. IF admin mở một roadmap mới hoặc một roadmap khác để chỉnh sửa, THE Sidebar SHALL hiển thị lại đầy đủ tất cả node đã tồn tại trong hệ thống (bao gồm các node đã được kéo vào canvas của roadmap khác).
6. THE Sidebar SHALL hiển thị danh sách các node đã tồn tại trong hệ thống, nhóm theo NodeType theo thứ tự role → skill → chapter → article với màu sắc/icon phân biệt rõ ràng giữa các loại, và hỗ trợ tìm kiếm theo tiêu đề với debounce 300ms.
7. WHEN admin kéo một node từ Sidebar vào Canvas và node đó đã tồn tại trên Canvas (cùng `node.id`), THE Canvas SHALL không thêm bản sao mà thay vào đó scroll-to và highlight node đã có trên Canvas.
8. WHEN admin kéo edge từ handle của node A đến node B, THE Canvas SHALL xác thực phân cấp theo Req 2.4. IF hợp lệ, THE Canvas SHALL tạo edge có hướng A → B. IF không hợp lệ, THE Canvas SHALL hủy kết nối và hiển thị toast lỗi phân cấp bằng tiếng Việt.
9. THE Canvas SHALL hiển thị trên mỗi edge số lượng node đang được kết nối tại đầu target của edge đó (ví dụ: node `skill` có 3 node `chapter` con thì mỗi edge vào `skill` đó hiển thị badge "3").
10. WHEN admin nhấn nút "Lưu" sau khi chỉnh sửa Canvas, THE Admin_App SHALL gọi GraphQL mutation để lưu toàn bộ trạng thái Canvas (nodes + edges + positions) trong vòng tối đa 10 giây. WHEN lưu thành công, THE Admin_App SHALL hiển thị toast thành công bằng tiếng Việt.
11. IF quá trình lưu thất bại hoặc timeout sau 10 giây, THEN THE Admin_App SHALL hiển thị toast lỗi với nội dung lỗi cụ thể bằng tiếng Việt và giữ nguyên trạng thái Canvas hiện tại.

---

### Requirement 4: Quản lý node trong Sidebar

**User Story:** Là một admin, tôi muốn quản lý danh sách node trong Sidebar (thêm, tìm kiếm, xóa vĩnh viễn), để tôi có thể duy trì kho node sạch sẽ và chính xác.

#### Acceptance Criteria

1. THE Sidebar SHALL luôn hiển thị rõ sự phân biệt giữa các loại NodeType bằng màu sắc và/hoặc icon đặc trưng cho từng loại (`role`, `skill`, `chapter`, `article`).
2. WHEN admin muốn xóa một node khỏi Sidebar, THE Sidebar SHALL hiển thị dialog xác nhận nêu rõ tên node và cảnh báo "Hành động này sẽ xóa vĩnh viễn node khỏi hệ thống" trước khi thực hiện.
3. WHEN admin xác nhận xóa node trong Sidebar, THE Admin_App SHALL gọi GraphQL mutation `deleteNode` để xóa vĩnh viễn node đó khỏi hệ thống, sau đó hiển thị toast thành công bằng tiếng Việt.
4. WHEN một node bị xóa vĩnh viễn khỏi hệ thống, IF node đó đang hiển thị trên Canvas của bất kỳ roadmap nào, THE Canvas SHALL chuyển node đó sang trạng thái Disabled_Node (hiển thị mờ với icon cảnh báo ⚠️ và không thể tương tác).
5. WHEN admin muốn dọn dẹp Canvas, THE Admin_App SHALL cho phép admin xóa riêng từng Disabled_Node trên Canvas thông qua context menu → "Xóa khỏi Canvas". Thao tác này chỉ xóa node khỏi Canvas, không ảnh hưởng đến hệ thống.
6. IF admin cố kéo một Disabled_Node vào Canvas, THE Canvas SHALL từ chối và hiển thị toast cảnh báo "Node này đã bị xóa khỏi hệ thống" bằng tiếng Việt.

---

### Requirement 5: Hover preview thông tin node

**User Story:** Là một admin hoặc viewer, tôi muốn xem nhanh thông tin của một node khi hover chuột vào nó, để tôi có thể hiểu nội dung mà không cần click vào từng node.

#### Acceptance Criteria

1. WHEN người dùng hover chuột vào một node bất kỳ trên Canvas trong thời gian ít nhất 300ms, THE Canvas SHALL hiển thị Hover_Preview gần vị trí con trỏ (trong viewport, không bị clip) chứa: tiêu đề node, NodeType, mô tả ngắn tối đa 200 ký tự (nếu có), và số lượng node con trực tiếp.
2. WHEN người dùng di chuyển chuột ra khỏi node và không di chuyển vào Hover_Preview trong vòng 100ms, THE Canvas SHALL ẩn Hover_Preview trong vòng 150ms.
3. WHEN người dùng hover vào node có NodeType là `role` hoặc `skill` VÀ node đó có ít nhất 1 node con, THE Canvas SHALL hiển thị thêm Graph_Preview bên trong Hover_Preview — một ReactFlow canvas thu nhỏ (read-only, kích thước cố định 320×240px) hiển thị cấu trúc node con bên trong.
4. THE Graph_Preview SHALL hiển thị tối đa 2 cấp con trực tiếp (tính từ node đang hover). IF tổng số node con vượt quá kích thước 320×240px, THEN THE Graph_Preview SHALL cho phép scroll bên trong vùng đó.
5. IF node có NodeType là `role` hoặc `skill` nhưng không có node con, THEN THE Hover_Preview SHALL hiển thị thông báo "Chưa có nội dung" thay vì Graph_Preview.
6. WHEN người dùng di chuyển chuột từ node vào vùng Hover_Preview (trong grace period 100ms), THE Canvas SHALL giữ Hover_Preview hiển thị.

---

### Requirement 6: Điều hướng đến trang chi tiết node

**User Story:** Là một viewer, tôi muốn click vào node để điều hướng đến trang chi tiết hoặc tài liệu tương ứng, để tôi có thể học nội dung của roadmap.

#### Acceptance Criteria

1. WHEN viewer click vào node có NodeType là `role` trong Web_App, THE Web_App SHALL điều hướng đến `/roadmap/[node.slug]` hiển thị cấu trúc ReactFlow bên trong node role đó.
2. WHEN viewer click vào node có NodeType là `skill` trong Web_App, THE Web_App SHALL điều hướng đến `/roadmap/[node.slug]` hiển thị cấu trúc ReactFlow bên trong node skill đó.
3. WHEN viewer click vào node có NodeType là `article` trong Web_App, THE Web_App SHALL hiển thị file type badge trên node cho biết loại tài liệu (`notion` hoặc `jupyter`) trước khi người dùng click.
4. WHEN viewer click vào node có NodeType là `article`, `articleType` là `notion`, VÀ `notionPageId` là non-null, THE Web_App SHALL mở URL `https://notion.so/{notionPageId}` trong tab mới.
5. WHEN viewer click vào node có NodeType là `article`, `articleType` là `jupyter`, VÀ `jupyterUrl` là non-null, THE Web_App SHALL mở `jupyterUrl` trong tab mới.
6. IF node có NodeType là `article` và thuộc một trong các trường hợp: `articleType` là null, hoặc `articleType` là `notion` với `notionPageId` null, hoặc `articleType` là `jupyter` với `jupyterUrl` null, THEN THE Web_App SHALL hiển thị icon cảnh báo ⚠️ trực tiếp trên node và tooltip "Tài liệu chưa được liên kết" khi hover, đồng thời không thực hiện điều hướng khi click.
7. THE RoadmapService SHALL mở rộng kiểu `RoadmapNode` để bao gồm các trường: `nodeType: NodeType`, `slug: string`, `articleType: 'notion' | 'jupyter' | null`, `jupyterUrl: string | null`.

---

### Requirement 7: NodeDetail Dialog khi double-click

**User Story:** Là một admin, tôi muốn xem thông tin đầy đủ và thực hiện các hành động trên một node bằng cách double-click vào nó, để tôi có thể quản lý node một cách nhanh chóng mà không rời khỏi Canvas.

#### Acceptance Criteria

1. WHEN admin double-click vào một node trên Canvas, THE Admin_App SHALL hiển thị NodeDetail_Dialog trong vòng 100ms chứa: tiêu đề node, NodeType (dạng badge), mô tả (nếu có), và với node `article` thêm `articleType` và link tài liệu tương ứng.
2. THE NodeDetail_Dialog SHALL hiển thị ba nút hành động ở cuối dialog: nút "Chỉnh sửa" (mở edit panel), nút "Xóa" (xóa node khỏi Canvas và hệ thống), và nút "Điều hướng" (mở trang chi tiết hoặc tài liệu của node trong tab mới).
3. WHEN admin click nút "Xóa" trong NodeDetail_Dialog, THE Admin_App SHALL đóng NodeDetail_Dialog và hiển thị dialog xác nhận xóa trước khi thực thi.
4. WHEN admin click nút "Điều hướng" trong NodeDetail_Dialog với node có NodeType `role` hoặc `skill`, THE Admin_App SHALL mở `/roadmap/[node.slug]` trong tab mới.
5. WHEN admin click nút "Điều hướng" trong NodeDetail_Dialog với node có NodeType `article` và tài liệu đã được liên kết, THE Admin_App SHALL mở URL tài liệu tương ứng trong tab mới.
6. IF admin click nút "Điều hướng" với node `article` chưa có tài liệu liên kết, THEN THE Admin_App SHALL hiển thị toast cảnh báo "Tài liệu chưa được liên kết" bằng tiếng Việt và không thực hiện điều hướng.

---

### Requirement 8: Thông báo lưu và tải lại trang

**User Story:** Là một viewer đang xem roadmap trên Web_App, tôi muốn biết khi nào có dữ liệu mới để tôi có thể tải lại trang và xem roadmap cập nhật.

#### Acceptance Criteria

1. WHEN admin lưu thay đổi thành công trong Admin_App, THE Web_App SHALL hiển thị banner thông báo cố định ở đầu trang: "Roadmap đã được cập nhật — tải lại trang để xem phiên bản mới nhất" kèm nút "Tải lại ngay".
2. WHEN viewer click nút "Tải lại ngay" trong banner, THE Web_App SHALL reload trang và hiển thị dữ liệu roadmap mới nhất.
3. THE RoadmapService SHALL phát tín hiệu cập nhật (thông qua cache invalidation tag hoặc server-sent event) trong vòng 500ms sau khi thao tác ghi hoàn tất thành công.
4. WHILE viewer đang xem một roadmap trong Web_App, THE Web_App SHALL lắng nghe tín hiệu cập nhật từ RoadmapService để hiển thị banner thông báo (Req 8.1) khi nhận được tín hiệu.
5. IF kết nối tín hiệu cập nhật bị ngắt, THEN THE Web_App SHALL tự động thử kết nối lại tối đa 3 lần với khoảng cách 2 giây mỗi lần. AFTER 3 lần thất bại liên tiếp, THE Web_App SHALL ẩn banner và không hiển thị thông báo thay đổi cho đến khi kết nối được khôi phục.
6. WHEN viewer tải lại trang, THE Web_App SHALL bảo toàn trạng thái `NodeStatus` (`locked | in_progress | done`) của từng node theo `nodeId` của viewer và overlay lên dữ liệu roadmap mới.

---

### Requirement 9: Quản lý metadata node

**User Story:** Là một admin, tôi muốn thêm và chỉnh sửa metadata của từng node (tiêu đề, mô tả, liên kết tài liệu), để nội dung roadmap đầy đủ thông tin cho viewer.

#### Acceptance Criteria

1. WHEN admin click nút "Chỉnh sửa" trong NodeDetail_Dialog hoặc chọn "Chỉnh sửa" từ context menu, THE Admin_App SHALL mở edit panel trong vòng 100ms với các trường: tiêu đề (bắt buộc, tối đa 150 ký tự), mô tả (tùy chọn, tối đa 500 ký tự), NodeType (chỉ đọc sau khi tạo, hiển thị dạng badge).
2. WHEN admin chỉnh sửa node có NodeType là `article`, THE Admin_App SHALL hiển thị thêm trường: `articleType` (radio: `notion | jupyter`, bắt buộc), `notionPageId` (text input, bắt buộc khi `articleType = notion`), `jupyterUrl` (URL input, bắt buộc khi `articleType = jupyter`).
3. IF admin nhấn "Lưu" khi tiêu đề node trống hoặc chỉ chứa khoảng trắng, THEN THE Admin_App SHALL hiển thị thông báo lỗi inline bên dưới trường tiêu đề và không thực hiện lưu.
4. WHEN admin xác nhận chỉnh sửa bằng nút "Lưu", THE Canvas SHALL cập nhật hiển thị node trong vòng 100ms (optimistic update) trong khi đồng thời gọi GraphQL mutation lưu bất đồng bộ đến RoadmapService.
5. IF yêu cầu lưu bất đồng bộ thất bại, THEN THE Canvas SHALL hoàn tác cập nhật hiển thị về trạng thái trước khi chỉnh sửa và hiển thị toast lỗi bằng tiếng Việt nêu rõ lý do thất bại.
6. IF admin nhấn "Lưu" khi `articleType = notion` và `notionPageId` trống, hoặc `articleType = jupyter` và `jupyterUrl` trống hoặc không phải URL hợp lệ, THEN THE Admin_App SHALL hiển thị toast lỗi validation tương ứng bằng tiếng Việt và không thực hiện lưu.
