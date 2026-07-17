# Roadmap Platform - Bento Grid Design System

Hệ thống thiết kế (Design System) của dự án **Roadmap Platform** kế thừa tinh thần thẩm mỹ **Bento Grid** hiện đại, kết hợp giữa phong cách tối giản có tổ chức của Nhật Bản và phong cách Neo-brutalism tương tác cao. Tài liệu này cung cấp chi tiết về bảng màu, typography, khoảng cách, viền, bóng, và các quy chuẩn layout components.

---

## 1. Bảng màu (Color Palette)

Hệ thống sử dụng bảng màu tương phản cao (High Contrast), tối ưu hóa trải nghiệm thị giác cho cả hai chế độ **Sáng (Light Mode)** và **Tối (Dark Mode)**.

| Thành phần | Mã màu Light | Mã màu Dark | Vai trò / Ứng dụng |
| :--- | :--- | :--- | :--- |
| **Nền chính (Canvas)** | `#F2F2F2` (Xám nhạt) | `#09090B` (`zinc-950`) | Tạo chiều sâu tối đa cho các khối Bento nổi phía trên. |
| **Nền khối (Card)** | `#FFFFFF` (Trắng) | `#18181B` (`zinc-900`) | Nền cho các ô Bento chính, tăng cường độ tương phản. |
| **Chữ chính (Text)** | `#0F172A` (`slate-900`) | `#F4F4F5` (`zinc-100`) | Đọc nội dung bài học, tiêu đề chính. |
| **Chữ phụ (Muted Text)**| `#71717A` (`zinc-500`) | `#A1A1AA` (`zinc-400`) | Thứ tự bài học, chú thích, siêu dữ liệu. |
| **Màu nhấn (Indigo)** | `#6366F1` (`indigo-500`) | `#6366F1` (`indigo-500`) | Thương hiệu, nút kêu gọi hành động, trạng thái active. |
| **Đang học (Amber)** | `#FBBF24` (`amber-400`) | `#F59E0B` (`amber-500`) | Trạng thái `in_progress` của các node học tập. |
| **Hoàn thành (Green)** | `#10B981` (`emerald-500`)| `#059669` (`emerald-600`)| Trạng thái `done` của bài học, tiến độ hoàn thành. |

---

## 2. Typography (Phông chữ & Kiểu chữ)

Dự án áp dụng font **Sans-serif** sạch sẽ, hiện đại để tối ưu hóa khả năng đọc sơ đồ cây và tài liệu Markdown.

- **Primary Font Family:** `Inter`, `system-ui`, `sans-serif`.
- **Code Font Family:** `JetBrains Mono`, `SFMono-Regular`, `monospace`.

### Tiêu chuẩn phân cấp kiểu chữ (Typographic Scale):

```css
/* Tiêu đề trang (Page Hero) */
.font-bento-hero {
  font-size: 2.25rem; /* text-4xl */
  font-weight: 900;    /* font-black */
  letter-spacing: -0.05em; /* tracking-tight */
  text-transform: uppercase;
}

/* Tiêu đề nhóm / Lộ trình (Section Header) */
.font-bento-title {
  font-size: 1.25rem;  /* text-xl */
  font-weight: 800;    /* font-extrabold */
  font-style: italic;
  text-transform: uppercase;
}

/* Kiểu chữ nội dung bài học */
.font-bento-body {
  font-size: 0.875rem; /* text-sm */
  line-height: 1.625;  /* leading-relaxed */
  font-weight: 400;
}
```

---

## 3. Quy chuẩn Viền & Bóng (Borders & Shadows)

Nét đặc trưng nhất của giao diện Bento Neo-brutalism là **đường viền dày đen** kết hợp với **bóng đổ cứng (Hard Shadows)** không làm mờ (non-blurry).

- **Độ dày đường viền (Border Width):**
  - Card bento chính: `border-4 border-black` (Light) hoặc `dark:border-zinc-800`.
  - Node & Button phụ: `border-2 border-black` (Light) hoặc `dark:border-zinc-700`.
- **Bóng đổ cứng (Bento Hard Shadow):**
  - Shadow lớn: `shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]` (Light) / `dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]`.
  - Shadow trung bình: `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`.
  - Shadow nút bấm nhỏ: `shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`.
- **Hiệu ứng tương tác (Micro-interactions):**
  - Khi hover: Dịch chuyển nhẹ lên phía trên: `hover:-translate-y-1 transition-all duration-300`.
  - Khi click (Active): Dịch chuyển xuống bằng độ dày của bóng đổ và triệt tiêu bóng để giả lập cảm giác nhấn phím vật lý thực thụ:
    `active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all`.

---

## 4. Các cấu trúc Layout Bento mẫu (Bento Structures)

### 4.1. Bento Grid 4 cột mẫu cho Dashboard:
```html
<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
  <!-- Ô lớn dọc (Vertical Card) -->
  <div class="col-span-2 row-span-2 bg-white dark:bg-zinc-900 border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
    <!-- Content -->
  </div>
  
  <!-- Ô ngang (Horizontal Card) -->
  <div class="col-span-2 bg-[#E0E7FF] dark:bg-indigo-950/20 border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
    <!-- Content -->
  </div>
  
  <!-- Ô nhỏ (Square Card) -->
  <div class="col-span-1 bg-[#FFEDD5] dark:bg-amber-950/20 border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
    <!-- Content -->
  </div>
</div>
```

---

## 5. Trạng thái Node Sơ đồ (Roadmap Node States)

Sơ đồ cây lộ trình học tập áp dụng nghiêm ngặt các quy tắc trạng thái trực quan để người học dễ nắm bắt tiến trình:

1. **Chưa học (Locked):**
   - Lớp bọc bên ngoài: `bg-zinc-50 border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400`
   - Biểu tượng: Khóa xám `Lock` dán ở góc dưới.
2. **Đang học (In Progress):**
   - Lớp bọc bên ngoài: `bg-amber-5 border-amber-400 dark:bg-amber-950/40 dark:border-amber-500 text-amber-800 dark:text-amber-300 shadow-md`
   - Biểu tượng: Đồng hồ cát / Đồng hồ xoay `Clock` màu vàng.
3. **Hoàn thành (Done):**
   - Lớp bọc bên ngoài: `bg-emerald-50 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-md`
   - Biểu tượng: Tích xanh `CheckCircle` lá cây.

---

## 6. Trình bày nội dung (Markdown Content Styling)

Các bài học được kéo về từ mock-up Notion hoặc sinh thông minh bởi Gemini AI được định dạng qua các lớp CSS bọc bento:

- **H1:** Sử dụng vạch gạch chân to bản hoặc khối đệm cạnh trái (`border-b-4 border-black pb-2 flex items-center gap-2`).
- **H2:** In nghiêng mạnh mẽ với nét gạch chân trang trí màu vàng ấm (`font-extrabold uppercase italic underline decoration-3 decoration-yellow-400 underline-offset-4`).
- **Code Block:** Bọc bằng viền đen sắc nét, bóng cứng, nền đen sâu thẳm mang tông màu xanh lá đặc trưng lập trình viên cổ điển (`border-2 border-black bg-zinc-950 text-emerald-400 p-4 rounded-xl font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`).
