# Requirements Document

## Introduction

Tính năng này bổ sung các cột thông tin chi tiết vào bảng danh sách Roadmap trong trang Quản lý Roadmap (`RoadmapListAdmin`). Hiện tại bảng chỉ có 5 cột: Tên, Slug, Nodes, Xuất bản, Hành động. Người dùng quản trị cần thêm các thông tin như mô tả ngắn, tên tác giả, ngày tạo, ngày cập nhật lần cuối để dễ dàng quản lý, phân biệt và tra cứu roadmap mà không cần vào từng trang chi tiết.

Tính năng này cũng bao gồm việc mở rộng kiểu dữ liệu `Roadmap` để khai báo các trường `createdAt`, `updatedAt`, và `author`/`authorId` phục vụ hiển thị UI.

## Glossary

- **RoadmapListAdmin**: Component React hiển thị danh sách tất cả roadmap (kể cả bản nháp) trong giao diện quản trị admin.
- **Roadmap**: Đối tượng dữ liệu đại diện cho một lộ trình học tập, định nghĩa trong `packages/core/src/roadmap/types.ts`.
- **RoadmapService**: Lớp service xử lý tất cả thao tác CRUD trên roadmap.
- **Metadata_Columns**: Các cột thông tin bổ sung trong bảng: mô tả, tác giả, ngày tạo, ngày cập nhật lần cuối.
- **Admin**: Người dùng có vai trò `admin` hoặc `super-admin`, có quyền truy cập trang Quản lý Roadmap.
- **Bản_nháp**: Roadmap có `isPublished = false`, chỉ hiển thị trong giao diện admin.
- **Author**: Người dùng đã tạo roadmap, được liên kết qua trường `authorId` hoặc đối tượng `author` nhúng trong `Roadmap`.

---

## Requirements

### Yêu cầu 1: Mở rộng kiểu dữ liệu Roadmap với các trường metadata

**User Story:** Là một lập trình viên, tôi muốn kiểu `Roadmap` có các trường `createdAt`, `updatedAt`, và `author`/`authorId`, để các thành phần UI có thể hiển thị thông tin thời gian và tác giả mà không cần tính toán lại từ nguồn khác.

#### Tiêu chí Chấp nhận

1. THE `Roadmap` SHALL chứa trường `createdAt` kiểu `string` (ISO 8601) biểu thị thời điểm tạo.
2. THE `Roadmap` SHALL chứa trường `updatedAt` kiểu `string` (ISO 8601) biểu thị thời điểm cập nhật lần cuối.
3. THE `Roadmap` SHALL chứa trường `authorId` kiểu `string` hoặc đối tượng `author` nhúng (có ít nhất `id` và `name`) biểu thị người tạo roadmap.

---

### Yêu cầu 2: Hiển thị cột "Mô tả" ngắn trong bảng danh sách

**User Story:** Là một admin, tôi muốn thấy mô tả ngắn của từng roadmap ngay trong danh sách, để tôi có thể phân biệt các roadmap có tên tương tự mà không cần vào trang chi tiết.

#### Tiêu chí Chấp nhận

1. THE `RoadmapListAdmin` SHALL hiển thị cột "Mô tả" trong bảng danh sách roadmap.
2. WHEN `description` của một roadmap có độ dài vượt quá 60 ký tự, THE `RoadmapListAdmin` SHALL cắt ngắn văn bản tại 60 ký tự và thêm dấu `…` ở cuối.
3. WHEN `description` của một roadmap là `null` hoặc chuỗi rỗng, THE `RoadmapListAdmin` SHALL hiển thị văn bản `—` (dấu gạch ngang) thay thế.
4. THE `RoadmapListAdmin` SHALL đặt cột "Mô tả" ở vị trí sau cột "Tên" và trước cột "Slug".

---

### Yêu cầu 3: Hiển thị cột "Tác giả" trong bảng danh sách

**User Story:** Là một admin, tôi muốn thấy tên tác giả của từng roadmap trong danh sách, để tôi biết ai đã tạo roadmap đó và có thể điều hướng đến trang chi tiết của tác giả khi cần.

#### Tiêu chí Chấp nhận

1. THE `RoadmapListAdmin` SHALL hiển thị cột "Tác giả" trong bảng danh sách roadmap.
2. WHEN `author` của một roadmap có giá trị hợp lệ, THE `RoadmapListAdmin` SHALL hiển thị tên tác giả dưới dạng liên kết có thể click.
3. WHEN người dùng click vào tên tác giả, THE `RoadmapListAdmin` SHALL điều hướng đến trang chi tiết của tác giả đó trong khu vực super-admin (VD: `/super-admin/users/{authorId}`).
4. WHEN `author` của một roadmap là `null` hoặc không có giá trị, THE `RoadmapListAdmin` SHALL hiển thị văn bản `—` (dấu gạch ngang) thay thế.
5. THE `RoadmapListAdmin` SHALL đặt cột "Tác giả" ở vị trí sau cột "Slug" và trước cột "Ngày tạo".

---

### Yêu cầu 4: Hiển thị cột "Ngày tạo" trong bảng danh sách

**User Story:** Là một admin, tôi muốn thấy ngày tạo của từng roadmap trong danh sách, để tôi có thể xác định nhanh roadmap nào mới được tạo.

#### Tiêu chí Chấp nhận

1. THE `RoadmapListAdmin` SHALL hiển thị cột "Ngày tạo" trong bảng danh sách roadmap.
2. WHEN `createdAt` của một roadmap có giá trị hợp lệ, THE `RoadmapListAdmin` SHALL hiển thị ngày theo định dạng `dd/MM/yyyy` (VD: `08/07/2026`).
3. THE `RoadmapListAdmin` SHALL đặt cột "Ngày tạo" ở vị trí sau cột "Tác giả" và trước cột "Cập nhật".

---

### Yêu cầu 5: Hiển thị cột "Cập nhật lần cuối" trong bảng danh sách

**User Story:** Là một admin, tôi muốn thấy thời gian cập nhật gần nhất của từng roadmap, để tôi biết roadmap nào đang được chỉnh sửa tích cực.

#### Tiêu chí Chấp nhận

1. THE `RoadmapListAdmin` SHALL hiển thị cột "Cập nhật" trong bảng danh sách roadmap.
2. WHEN `updatedAt` của một roadmap nhỏ hơn 24 giờ tính từ thời điểm hiển thị, THE `RoadmapListAdmin` SHALL hiển thị thời gian tương đối (VD: `2 giờ trước`, `30 phút trước`).
3. WHEN `updatedAt` của một roadmap từ 24 giờ trở lên tính từ thời điểm hiển thị, THE `RoadmapListAdmin` SHALL hiển thị ngày theo định dạng `dd/MM/yyyy`.
4. THE `RoadmapListAdmin` SHALL đặt cột "Cập nhật" ở vị trí sau cột "Ngày tạo" và trước cột "Nodes".

---

### Yêu cầu 6: Thứ tự cột cuối cùng và tính nhất quán bảng

**User Story:** Là một admin, tôi muốn bảng danh sách roadmap có thứ tự cột hợp lý và nhất quán, để tôi có thể đọc thông tin theo luồng tự nhiên từ trái sang phải.

#### Tiêu chí Chấp nhận

1. THE `RoadmapListAdmin` SHALL hiển thị các cột theo thứ tự: **Tên → Mô tả → Slug → Tác giả → Ngày tạo → Cập nhật → Nodes → Xuất bản → Hành động**.
2. WHEN bảng không có roadmap nào, THE `RoadmapListAdmin` SHALL hiển thị dòng thông báo trống `colspan` bằng tổng số cột mới (9 cột).
3. THE `RoadmapListAdmin` SHALL giữ nguyên hành vi click vào hàng để điều hướng đến trang builder của roadmap tương ứng.
