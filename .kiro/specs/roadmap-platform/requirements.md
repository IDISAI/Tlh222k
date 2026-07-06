# Requirements Document

## Introduction

Roadmap Platform là một ứng dụng web clone của [roadmap.sh](https://roadmap.sh) — nền tảng học lập trình theo lộ trình có cấu trúc. Hệ thống cho phép người dùng khám phá các lộ trình học tập (Frontend, Backend, DevOps, v.v.) dưới dạng sơ đồ cây tương tác, theo dõi tiến độ học tập cá nhân, và xem nội dung chi tiết của từng chủ đề thông qua tích hợp Notion.

Dự án được xây dựng trên Turborepo monorepo gồm ba ứng dụng Next.js:
- **`apps/web`** (port 3000) — giao diện công khai cho Khách và Viewer
- **`apps/admin`** (port 3002, basePath `/admin`) — giao diện quản trị cho Admin
- **`apps/super-admin`** (port 3003) — giao diện quản trị cấp cao cho Super-Admin

Backend được xây dựng trên NestJS (`apps/svc-roadmap`) với GraphQL (Apollo) làm transport chính giữa frontend và backend, REST chỉ phục vụ Swagger documentation. Domain logic tập trung tại `packages/core`, các ứng dụng chỉ import và tuỳ chỉnh.

---

## Glossary

- **Guest**: Người dùng chưa đăng nhập; có thể xem roadmap nhưng không thể track tiến độ.
- **Viewer**: Người dùng đã đăng nhập với Clerk, không có `publicMetadata.role` đặc biệt; có thể xem và track tiến độ.
- **Admin**: Người dùng đã đăng nhập với `publicMetadata.role = "admin"`; có quyền quản trị nội dung roadmap.
- **Super_Admin**: Người dùng với `publicMetadata.role = "super-admin"`; có toàn quyền hệ thống.
- **Clerk**: Dịch vụ xác thực và quản lý người dùng (thay thế Auth.js); lưu role trong `publicMetadata` của JWT.
- **PlatformSwitch**: Component điều hướng role-aware trong `packages/core/src/navigation/`, hiển thị link đến các app zone phù hợp với role hiện tại.
- **Roadmap**: Một lộ trình học tập (ví dụ: "Frontend Developer"); bao gồm danh sách Node có cấu trúc cây.
- **Node**: Một chủ đề học tập trong Roadmap (ví dụ: "HTML", "CSS"); có thể có Node cha và Node con.
- **NodeStatus**: Trạng thái học tập của một Node đối với một Viewer cụ thể — một trong ba giá trị: `locked` (chưa học), `in_progress` (đang học), `done` (hoàn thành).
- **InteractiveRoadmap**: Component sơ đồ cây có thể thu phóng và kéo thả, hiển thị Node với màu sắc theo NodeStatus.
- **NodeDrawer**: Panel trượt từ phải sang, hiển thị nội dung Markdown chi tiết của Node lấy từ svc-notion.
- **svc-roadmap**: NestJS backend service, cung cấp GraphQL API cho dữ liệu roadmap và tiến độ người dùng.
- **svc-notion**: NestJS service tích hợp Notion, phục vụ nội dung Markdown cho từng Node theo slug.
- **GraphQL_Client**: Apollo Client được cấu hình tại `apps/web` và `apps/admin` để giao tiếp với svc-roadmap.
- **GraphQL_Codegen**: Công cụ tự động sinh TypeScript types từ GraphQL schema, đồng bộ types giữa FE và BE.
- **Dashboard**: Trang `/dashboard` trong `apps/web` hiển thị tiến độ học tập cá nhân tổng hợp theo từng Roadmap.
- **Multi_Zone**: Kiến trúc Next.js Multi-Zones — `apps/admin` được mount tại `/admin`, `apps/super-admin` tại `/super-admin`, tất cả chạy trên cùng một domain thông qua proxy hoặc rewrites.
- **Proxy**: File `proxy.ts` tại root của mỗi Next.js app (không phải `middleware.ts`) — convention của Next.js 16 để cấu hình forwarding requests giữa các zone.
- **ThemeToggle**: Component chuyển đổi Dark Mode / Light Mode, có trong header của tất cả các app.
- **user_progress**: Bảng DB lưu trạng thái học tập: `(clerkId, nodeId) → NodeStatus`.

---

## Requirements

### Yêu cầu 1: Hiển thị Danh sách Roadmap

**User Story:** Là một Guest hoặc Viewer, tôi muốn xem danh sách các roadmap có sẵn, để tôi có thể chọn lộ trình phù hợp để bắt đầu học.

#### Acceptance Criteria

1. THE Web_App SHALL hiển thị danh sách Roadmap tại route `/roadmaps` mà không yêu cầu đăng nhập.
2. WHEN người dùng truy cập `/roadmaps`, THE Web_App SHALL hiển thị các Roadmap dưới dạng card, mỗi card gồm tiêu đề, mô tả ngắn (tối đa 160 ký tự) và thumbnail; IF thumbnail không có sẵn, THEN THE Web_App SHALL hiển thị ảnh placeholder thay thế.
3. WHEN người dùng click vào một Roadmap card, THE Web_App SHALL điều hướng đến `/roadmap/[slug]`.
4. IF svc-roadmap không phản hồi trong vòng 5 giây, THEN THE Web_App SHALL hiển thị trạng thái lỗi kèm nút thử lại; WHEN người dùng click nút thử lại, THE Web_App SHALL gửi lại request đến svc-roadmap.
5. WHILE Dark Mode đang active, THE Web_App SHALL áp dụng dark theme cho trang `/roadmaps`.
6. IF svc-roadmap trả về 0 roadmap, THEN THE Web_App SHALL hiển thị empty state thông báo "Chưa có roadmap nào" thay vì trang trắng.


### Yêu cầu 2: Interactive Roadmap — Sơ đồ cây tương tác

**User Story:** Là một Guest hoặc Viewer, tôi muốn xem sơ đồ lộ trình học dạng cây tương tác có thể thu phóng và kéo thả, để tôi hình dung được toàn bộ hành trình học tập.

#### Acceptance Criteria

1. WHEN người dùng truy cập `/roadmap/[slug]`, THE InteractiveRoadmap SHALL render sơ đồ cây đầy đủ các Node của Roadmap tương ứng.
2. THE InteractiveRoadmap SHALL cho phép thu phóng (zoom in/out) bằng scroll chuột hoặc gesture pinch trên thiết bị cảm ứng, trong khoảng từ 25% đến 200%.
3. THE InteractiveRoadmap SHALL cho phép kéo thả (pan) canvas để di chuyển góc nhìn khi sơ đồ lớn hơn viewport.
4. WHILE Viewer đã đăng nhập, THE InteractiveRoadmap SHALL hiển thị Node với màu sắc theo NodeStatus: mặc định (locked), màu vàng (in_progress), màu xanh lá (done).
5. WHILE Guest chưa đăng nhập, THE InteractiveRoadmap SHALL hiển thị tất cả Node ở trạng thái mặc định (locked) không có màu trạng thái cá nhân hoá.
6. IF slug của Roadmap không tồn tại trong hệ thống, THEN THE Web_App SHALL trả về trang 404 với thông báo rõ ràng và link trở về `/roadmaps`.
7. THE InteractiveRoadmap SHALL hỗ trợ Dark Mode, đồng bộ với trạng thái ThemeToggle hiện tại.


### Yêu cầu 3: Node Drawer — Nội dung chi tiết

**User Story:** Là một Guest hoặc Viewer, tôi muốn click vào một Node để đọc nội dung chi tiết, để tôi hiểu rõ chủ đề cần học mà không rời khỏi trang roadmap.

#### Acceptance Criteria

1. WHEN người dùng click vào một Node trên InteractiveRoadmap, THE NodeDrawer SHALL trượt ra từ bên phải trong vòng 300ms.
2. WHEN NodeDrawer mở, THE svc-notion SHALL cung cấp nội dung Markdown của Node theo nodeId, và THE NodeDrawer SHALL render nội dung đó dưới dạng HTML được định dạng đúng.
3. WHILE Guest chưa đăng nhập và NodeDrawer đang mở, THE NodeDrawer SHALL hiển thị call-to-action "Đăng nhập để theo dõi tiến độ" với link đến `/sign-in`.
4. WHILE Viewer đã đăng nhập và NodeDrawer đang mở, THE NodeDrawer SHALL hiển thị ba nút trạng thái: "Locked", "In Progress", "Done" để cập nhật NodeStatus.
5. WHEN người dùng nhấn phím Escape hoặc click ra ngoài vùng NodeDrawer, THE NodeDrawer SHALL đóng lại.
6. IF svc-notion không phản hồi trong vòng 5 giây, THEN THE NodeDrawer SHALL hiển thị thông báo lỗi thay cho nội dung Markdown.
7. THE NodeDrawer SHALL hỗ trợ Dark Mode, đồng bộ với ThemeToggle.

### Yêu cầu 4: Xác thực người dùng — Luồng đăng nhập

**User Story:** Là một người dùng chưa đăng nhập, tôi muốn đăng nhập vào hệ thống qua Clerk, để tôi có thể truy cập các tính năng cá nhân hoá.

#### Acceptance Criteria

1. THE Web_App SHALL cung cấp trang đăng nhập tại `/sign-in` sử dụng Clerk hosted UI.
2. WHEN Viewer đăng nhập thành công tại `/sign-in`, THE Web_App SHALL redirect người dùng đến `/roadmaps`.
3. WHEN Admin đăng nhập thành công tại `/admin/sign-in`, THE Admin_App SHALL redirect người dùng đến `/admin`.
4. WHEN người dùng hoàn tất đăng nhập, THE Clerk_Integration SHALL đọc `publicMetadata.role` từ JWT để xác định role người dùng.
5. IF người dùng chưa đăng nhập cố gắng truy cập `/dashboard`, THEN THE Web_App SHALL redirect người dùng về `/sign-in?redirect_url=<encoded-url>` để quay lại sau khi đăng nhập.
6. IF người dùng đã đăng nhập truy cập `/sign-in`, THEN THE Web_App SHALL redirect về `/roadmaps` thay vì hiển thị form đăng nhập.


### Yêu cầu 5: Phân quyền theo Role — Kiểm soát truy cập

**User Story:** Là một hệ thống đa role, tôi muốn đảm bảo mỗi loại người dùng chỉ truy cập đúng phần mà họ được phép, để bảo vệ các tài nguyên quản trị.

#### Acceptance Criteria

1. WHILE người dùng có `publicMetadata.role = "admin"`, THE PlatformSwitch SHALL hiển thị link "Admin" dẫn đến `/admin` bên cạnh link "Web".
2. WHILE người dùng có `publicMetadata.role = "super-admin"`, THE PlatformSwitch SHALL hiển thị đủ ba link: "Web", "Admin", và "Super Admin".
3. WHILE người dùng đã đăng nhập và `publicMetadata.role` không bằng `"admin"` và không bằng `"super-admin"`, THE PlatformSwitch SHALL chỉ hiển thị link "Web".
4. IF một Viewer cố gắng truy cập trực tiếp route bắt đầu bằng `/admin` (ngoại trừ `/admin/sign-in`), THEN THE Admin_App SHALL redirect người dùng về `/admin/sign-in`.
5. WHEN `publicMetadata` vắng mặt trong JWT, THE System SHALL coi role là `"viewer"` (không dựa vào Clerk Dashboard config).
6. WHEN Guest (chưa đăng nhập) cố gắng truy cập `/admin` (ngoại trừ `/admin/sign-in`), THEN THE Admin_App SHALL redirect về `/admin/sign-in`.

### Yêu cầu 6: PlatformSwitch — Điều hướng đa app

**User Story:** Là một Admin hoặc Super-Admin, tôi muốn chuyển đổi nhanh giữa các app (Web, Admin, Super-Admin) trong cùng một session, để không phải đăng nhập lại ở mỗi zone.

#### Acceptance Criteria

1. THE PlatformSwitch SHALL sử dụng thẻ `<a>` với href tuyệt đối (root-absolute) thay vì Next.js `<Link>`, để đảm bảo điều hướng chính xác qua các Multi_Zone boundary.
2. WHEN người dùng đang ở zone hiện tại, THE PlatformSwitch SHALL đánh dấu link tương ứng với `aria-current="page"` và style active khác biệt (`font-weight: bold` và `text-decoration: underline`).
3. THE PlatformSwitch SHALL nhận prop `current` kiểu `"web" | "admin" | "super-admin"` để xác định zone đang hoạt động.
4. WHERE `publicMetadata.role` được cung cấp, THE PlatformSwitch SHALL lọc danh sách platform links hiển thị dựa trên role, ẩn các link không có quyền truy cập.
5. IF prop `current` nhận giá trị không thuộc union `"web" | "admin" | "super-admin"`, THEN THE PlatformSwitch SHALL log warning và fallback về không có link nào được active.


### Yêu cầu 7: Progress Tracking — Theo dõi tiến độ học tập

**User Story:** Là một Viewer, tôi muốn đánh dấu trạng thái học tập của từng Node (locked → in_progress → done), để theo dõi và quản lý tiến độ của mình.

#### Acceptance Criteria

1. WHEN Viewer click nút "In Progress" trong NodeDrawer, THE Progress_Tracker SHALL cập nhật NodeStatus của Node đó thành `in_progress` cho `clerkId` hiện tại.
2. WHEN Viewer click nút "Done" trong NodeDrawer, THE Progress_Tracker SHALL cập nhật NodeStatus thành `done`.
3. WHEN Viewer click nút "Locked" trong NodeDrawer, THE Progress_Tracker SHALL đặt lại NodeStatus về `locked`.
4. THE Progress_Tracker SHALL thực hiện Optimistic UI update: hiển thị trạng thái mới trong vòng 100ms trước khi GraphQL mutation hoàn thành.
5. IF GraphQL mutation thất bại hoặc không phản hồi trong 10 giây, THEN THE Progress_Tracker SHALL rollback NodeStatus về giá trị trước đó và hiển thị thông báo lỗi cho người dùng.
6. WHEN Viewer cập nhật NodeStatus, THE Progress_Tracker SHALL upsert record dựa trên `(clerkId, nodeId)` vào bảng `user_progress` — nếu record đã tồn tại thì update, không tạo duplicate.
7. WHEN Viewer tải lại trang `/roadmap/[slug]`, THE InteractiveRoadmap SHALL hiển thị đúng NodeStatus đã lưu từ bảng `user_progress`; IF không có dữ liệu cho Node đó, THEN THE InteractiveRoadmap SHALL hiển thị Node đó với NodeStatus mặc định `locked`.

### Yêu cầu 8: Dashboard — Tổng quan tiến độ cá nhân

**User Story:** Là một Viewer, tôi muốn xem tổng quan tiến độ học tập của mình trên tất cả các roadmap, để đánh giá mức độ hoàn thành và lên kế hoạch tiếp theo.

#### Acceptance Criteria

1. THE Web_App SHALL cung cấp route `/dashboard` là protected route — chỉ Viewer và Admin được truy cập.
2. WHEN Viewer truy cập `/dashboard`, THE Dashboard SHALL hiển thị danh sách tất cả Roadmap mà Viewer đã có ít nhất một Node có status khác `locked`.
3. THE Dashboard SHALL hiển thị progress bar cho từng Roadmap, thể hiện tỷ lệ `(số Node status = done) / (tổng số Node)` dưới dạng phần trăm làm tròn xuống số nguyên (Math.floor).
4. THE Dashboard SHALL hiển thị số liệu dạng `X/N nodes done` bên cạnh progress bar, trong đó X là số Node done, N là tổng Node.
5. IF Viewer chưa có tiến độ trên bất kỳ Roadmap nào, THEN THE Dashboard SHALL hiển thị trạng thái rỗng kèm gợi ý link đến `/roadmaps`.
6. IF người dùng chưa đăng nhập truy cập `/dashboard`, THEN THE Web_App SHALL redirect về `/sign-in?redirectUrl=/dashboard`.
7. IF loading dữ liệu, THEN THE Dashboard SHALL hiển thị skeleton loading state trong khi chờ API response.


### Yêu cầu 9: GraphQL API — Giao tiếp Frontend ↔ Backend

**User Story:** Là một developer, tôi muốn tất cả giao tiếp giữa frontend và backend được thực hiện qua GraphQL Apollo, để đảm bảo type-safety và khả năng introspection.

#### Acceptance Criteria

1. THE svc_roadmap SHALL cung cấp GraphQL endpoint tại `/graphql` với Apollo Server.
2. THE GraphQL_Schema SHALL định nghĩa Query cho: `roadmaps`, `roadmap(slug)`, `nodes(roadmapId)`, `userProgress(clerkId, roadmapId)`.
3. THE GraphQL_Schema SHALL định nghĩa Mutation cho: `setNodeStatus(nodeId, status)`, trong đó `status` phải là một trong các giá trị enum hợp lệ: `"locked" | "in_progress" | "done"`.
4. THE GraphQL_Codegen SHALL tự động sinh TypeScript types từ schema vào `packages/core/src/graphql/generated.ts` và các app tương ứng, đảm bảo type-safety end-to-end.
5. THE svc_roadmap SHALL cung cấp REST endpoints được document tại `/api-docs` qua Swagger, chỉ dành cho documentation — không được dùng REST cho FE communication.
6. WHEN schema GraphQL thay đổi, THE GraphQL_Codegen SHALL cần chạy lại để sync types, quá trình này phải được tích hợp vào CI pipeline.
7. IF GraphQL server trả về lỗi validation, THEN THE svc_roadmap SHALL trả về error có extension code rõ ràng (`BAD_USER_INPUT`, `UNAUTHENTICATED`, v.v.).

### Yêu cầu 10: Database Schema — Thiết kế dữ liệu

**User Story:** Là một developer, tôi muốn có database schema rõ ràng cho tất cả entities của hệ thống, để đảm bảo tính toàn vẹn dữ liệu và dễ mở rộng.

#### Acceptance Criteria

1. THE Database SHALL có bảng `roadmaps` với các trường: `id`, `slug` (unique), `title`, `description`, `thumbnailUrl`, `createdAt`, `updatedAt`.
2. THE Database SHALL có bảng `nodes` với các trường: `id`, `roadmapId` (FK → roadmaps), `parentId` (FK → nodes, nullable cho root node), `title`, `notionPageId`, `order` (số nguyên không âm), `createdAt`, `updatedAt`.
3. THE Database SHALL có bảng `user_progress` với các trường: `id`, `clerkId`, `nodeId` (FK → nodes), `status` (enum: `locked`, `in_progress`, `done`), `updatedAt`; với unique constraint trên `(clerkId, nodeId)`.
4. THE Prisma_Schema SHALL định nghĩa đầy đủ relations giữa `roadmaps`, `nodes`, và `user_progress` để hỗ trợ eager loading hiệu quả.
5. THE Database SHALL sử dụng PostgreSQL trên Supabase, được truy cập qua Prisma ORM trong `packages/db`.
6. WHEN `user_progress` record đã tồn tại cho `(clerkId, nodeId)`, THE Database SHALL thực hiện upsert thay vì insert để tránh duplicate.
7. WHEN một Roadmap bị xoá, THE Database SHALL cascade xoá tất cả Node thuộc Roadmap đó.


### Yêu cầu 11: Admin App — Quản trị nội dung Roadmap

**User Story:** Là một Admin, tôi muốn quản lý nội dung roadmap (thêm, sửa, xoá node) trong Admin App, để duy trì và cập nhật nội dung học tập cho người dùng.

#### Acceptance Criteria

1. THE Admin_App SHALL cung cấp giao diện quản lý roadmap tại `/admin/roadmaps`, chỉ truy cập được khi người dùng có `publicMetadata.role = "admin"` hoặc `"super-admin"`.
2. WHEN Admin click "Thêm Node", THE Admin_App SHALL hiển thị form tạo Node mới với các trường: tiêu đề (tối đa 255 ký tự), node cha (optional), notionPageId, thứ tự hiển thị.
3. WHEN Admin lưu thay đổi Node, THE Admin_App SHALL gửi GraphQL mutation đến svc_roadmap và hiển thị kết quả thành công hoặc thông báo lỗi mô tả nguyên nhân cụ thể.
4. WHEN Admin xoá một Node có Node con, THE Admin_App SHALL yêu cầu xác nhận và hiển thị dialog thông báo số Node con cụ thể sẽ bị xoá cùng.
5. THE Admin_App SHALL sử dụng `basePath = "/admin"` trong `next.config.ts` để tích hợp với Multi_Zone architecture.
6. IF người dùng không có role `admin` hoặc `super-admin` cố gắng truy cập `/admin/roadmaps`, THEN THE Admin_App SHALL redirect về `/admin/sign-in`.

### Yêu cầu 12: Super-Admin App — Quản trị hệ thống (Future Work)

**User Story:** Là một Super-Admin, tôi muốn có app riêng để quản lý toàn bộ hệ thống bao gồm quản lý user và cấu hình platform, để có full control mà không ảnh hưởng đến Admin App.

#### Acceptance Criteria

1. THE Super_Admin_App SHALL phục vụ tại port 3003 và được mount tại `/super-admin` trong Multi_Zone configuration.
2. WHERE Clerk chưa được tích hợp vào Super_Admin_App, THE Super_Admin_App SHALL hiển thị cảnh báo rõ ràng trong UI rằng authentication chưa được bảo vệ — đây là known gap.
3. WHEN Clerk được tích hợp vào Super_Admin_App (future), THE Super_Admin_App SHALL cung cấp trang đăng nhập tại `/super-admin/sign-in` và redirect về `/super-admin` sau khi xác thực thành công.
4. WHEN Clerk được tích hợp, IF người dùng không có `publicMetadata.role = "super-admin"`, THEN THE Super_Admin_App SHALL redirect về `/super-admin/sign-in`.
5. THE PlatformSwitch SHALL hiển thị link "Super Admin" chỉ khi người dùng có `publicMetadata.role = "super-admin"`.

### Yêu cầu 13: Notion Integration — Nội dung bài học

**User Story:** Là một Viewer, tôi muốn xem nội dung bài học được lấy từ Notion khi click vào Node, để đọc tài liệu học tập được biên soạn sẵn.

#### Acceptance Criteria

1. THE svc_notion SHALL cung cấp endpoint nhận `notionPageId` và trả về nội dung Markdown đã được parse từ Notion page tương ứng trong vòng 10 giây; IF không phản hồi trong 10 giây, THEN THE svc_notion SHALL trả về lỗi timeout.
2. WHEN NodeDrawer mở, THE Web_App SHALL gọi svc_notion với `notionPageId` của Node; THE NodeDrawer SHALL hiển thị skeleton loading trong khi chờ response từ svc_notion, sau đó render kết quả Markdown thành HTML trong NodeDrawer.
3. THE Notion_Parser SHALL parse nội dung Notion page thành chuỗi Markdown hợp lệ.
4. THE Notion_Printer SHALL format một Markdown string thành cấu trúc block chuẩn để có thể đẩy ngược lên Notion (round-trip requirement).
5. FOR ALL nội dung Notion page hợp lệ, quá trình parse Markdown rồi print rồi parse lại SHALL tạo ra nội dung tương đương về mặt ngữ nghĩa (round-trip property).
6. IF `notionPageId` của Node không tồn tại hoặc Notion API trả về lỗi, THEN THE svc_notion SHALL trả về lỗi có mô tả rõ ràng và THE NodeDrawer SHALL hiển thị thông báo "Nội dung chưa có sẵn".
7. THE svc_notion SHALL hỗ trợ tối thiểu các Notion block types: `paragraph`, `heading_1`, `heading_2`, `heading_3`, `bulleted_list_item`, `numbered_list_item`, `code`, `image`.


### Yêu cầu 14: Dark Mode & Theming

**User Story:** Là một người dùng, tôi muốn chuyển đổi giữa Dark Mode và Light Mode trên tất cả các app, để trải nghiệm thoải mái hơn theo sở thích và điều kiện ánh sáng.

#### Acceptance Criteria

1. THE ThemeToggle SHALL cung cấp khả năng chuyển đổi giữa `light`, `dark`, và `system` (theo OS preference).
2. THE Web_App, THE Admin_App, và THE Super_Admin_App SHALL đều tích hợp ThemeToggle trong header.
3. WHEN người dùng chọn theme, THE ThemeProvider SHALL lưu lựa chọn vào `localStorage` và áp dụng class tương ứng lên thẻ `<html>` ngay lập tức không cần reload trang.
4. WHEN người dùng tải lại trang, THE ThemeProvider SHALL khôi phục theme đã chọn từ `localStorage`, tránh flash of unstyled content.
5. THE InteractiveRoadmap SHALL phản ứng với thay đổi theme theo thời gian thực, không cần reload trang.
6. IF `localStorage` trống hoặc giá trị không hợp lệ (không thuộc `"light" | "dark" | "system"`), THEN THE ThemeProvider SHALL fallback về `"system"`.

---

## Correctness Properties

### Domain: Roadmap Feature

| # | Property | Loại | Mô tả |
|---|----------|------|-------|
| R1 | **Danh sách → Detail Consistency** | Invariant | Mọi Roadmap hiển thị trong `/roadmaps` phải tồn tại và load được tại `/roadmap/[slug]` — không có broken link. |
| R2 | **Node Tree Integrity** | Invariant | Mỗi Node trong cây Roadmap phải có `parentId` trỏ đến Node đang tồn tại (hoặc null cho root); không có cycle. |
| R3 | **Slug Uniqueness** | Invariant | Với mọi hai Roadmap `A` và `B`, nếu `A.slug = B.slug` thì `A.id = B.id`. |
| R4 | **Zoom Bounds** | Invariant | Sau bất kỳ thao tác zoom nào, zoom level của InteractiveRoadmap luôn thuộc khoảng `[0.25, 2.0]`. |

### Domain: Authentication & Authorization

| # | Property | Loại | Mô tả |
|---|----------|------|-------|
| A1 | **Role Monotonicity** | Invariant | Nếu người dùng có role `super-admin` thì họ có toàn bộ quyền của `admin` và `viewer`. Nếu có role `admin` thì có quyền của `viewer`. |
| A2 | **Redirect After Login** | Round-trip | Nếu Guest bị redirect từ `/dashboard` về `/sign-in?redirectUrl=/dashboard`, sau khi đăng nhập thành công họ phải được redirect về `/dashboard`, không phải `/roadmaps`. |
| A3 | **JWT Role Claim** | Invariant | `publicMetadata.role` trong Clerk JWT luôn đồng bộ với role được lưu trên Clerk Dashboard — không bao giờ stale hơn 1 phiên. |

### Domain: Progress Tracking

| # | Property | Loại | Mô tả |
|---|----------|------|-------|
| P1 | **Status State Machine** | Invariant | NodeStatus chỉ có thể là một trong ba giá trị hợp lệ: `locked`, `in_progress`, `done`. Mọi giá trị khác trong DB là dữ liệu hỏng. |
| P2 | **Upsert Idempotency** | Idempotence | Gọi `setNodeStatus(nodeId, "done")` hai lần liên tiếp cho cùng một user phải có kết quả tương đương gọi một lần — không tạo duplicate record. |
| P3 | **Optimistic Rollback** | Round-trip | Nếu mutation thất bại, UI phải trở về đúng NodeStatus trước khi optimistic update — `status_after_rollback = status_before_mutation`. |
| P4 | **Cross-Roadmap Isolation** | Invariant | Cập nhật NodeStatus của Node thuộc Roadmap A không được ảnh hưởng đến bất kỳ Node nào thuộc Roadmap B. |

### Domain: Dashboard

| # | Property | Loại | Mô tả |
|---|----------|------|-------|
| D1 | **Progress Percentage Bounds** | Invariant | Tỷ lệ hoàn thành của mỗi Roadmap luôn thuộc khoảng `[0%, 100%]`. |
| D2 | **Progress ↔ Tracker Consistency** | Metamorphic | Tổng số Node `done` hiển thị trên Dashboard phải bằng đúng số record có `status = "done"` trong bảng `user_progress` cho `clerkId` đó trên Roadmap đó. |
| D3 | **Completion Threshold** | Metamorphic | Khi tất cả N Node của một Roadmap có status `done`, Dashboard phải hiển thị `N/N` và `100%`. |

### Domain: Database & API

| # | Property | Loại | Mô tả |
|---|----------|------|-------|
| DB1 | **GraphQL Type Safety** | Invariant | Mọi type được GraphQL_Codegen sinh ra phải match đúng với schema của svc_roadmap — không có type mismatch giữa FE và BE sau khi codegen chạy. |
| DB2 | **Unique Progress Constraint** | Idempotence | Bảng `user_progress` không bao giờ có hai record với cùng `(clerkId, nodeId)` — unique constraint phải được enforce ở cả DB level và application level. |
| DB3 | **Node Deletion Cascade** | Metamorphic | Khi một Node bị xoá, tất cả record trong `user_progress` liên quan đến `nodeId` đó phải được xoá theo (CASCADE hoặc xử lý trong service). |

### Domain: Notion Integration

| # | Property | Loại | Mô tả |
|---|----------|------|-------|
| N1 | **Parse-Print Round-trip** | Round-trip | Với mọi nội dung Notion page hợp lệ P: `parse(print(parse(P)))` phải tương đương về mặt ngữ nghĩa với `parse(P)`. Đây là property bắt buộc vì parsers/printers rất dễ có edge cases. |
| N2 | **Markdown Validity** | Invariant | Mọi output của Notion_Parser phải là chuỗi Markdown hợp lệ — có thể được render bởi standard Markdown parser mà không gây lỗi. |
