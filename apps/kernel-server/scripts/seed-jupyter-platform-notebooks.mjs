/**
 * Seed content notebooks for "Jupyter Notebook Platform" roadmap.
 * Run: node apps/kernel-server/scripts/seed-jupyter-platform-notebooks.mjs
 * Requires: kernel-server running on KERNEL_SERVER_URL (default localhost:3006)
 */

const BASE = process.env.KERNEL_SERVER_URL ?? "http://localhost:3006"

let cellId = 0
const md = (source) => ({
  id: `jup-seed-${++cellId}`,
  cell_type: "markdown",
  source,
  metadata: {},
})
const code = (source) => ({
  id: `jup-seed-${++cellId}`,
  cell_type: "code",
  source,
  metadata: {},
  execution_count: null,
  outputs: [],
})

const notebooks = {
  // ── 1. Tạo notebook mới ───────────────────────────────────────────────────
  "tao-notebook-moi": {
    title: "Tạo notebook mới",
    cells: [
      md("# Tạo Notebook Mới\n\nHướng dẫn tạo và quản lý notebook trong Admin Editor."),
      md("## Cách tạo\n\n1. Vào **Admin** → `/notebooks`\n2. Bấm **+ New Notebook**\n3. Nhập tên → bấm **Tạo**\n4. Trang chuyển sang editor với notebook mới.\n\nNotebook được lưu ngay với tiêu đề bạn nhập."),
      md("## Autosave\n\nMọi thay đổi tự động lưu sau **1 giây** không hoạt động.\n\n| Trạng thái | Ý nghĩa |\n|---|---|\n| *(trống)* | Không thay đổi |\n| Chưa lưu… | Đang chờ autosave |\n| Đang lưu… | Đang gửi server |\n| Đã lưu | Đã lưu thành công |"),
      code("# Notebook này đang chạy trên kernel thật\nprint('Notebook sẵn sàng!')\nprint('Autosave hoạt động ở background.')"),
    ],
  },

  // ── 2. Thêm & chỉnh sửa cells ─────────────────────────────────────────────
  "them-chinh-sua-cells": {
    title: "Thêm & chỉnh sửa cells",
    cells: [
      md("# Thêm & Chỉnh Sửa Cells\n\nNotebook gồm hai loại cell: **Code** và **Markdown**."),
      md("## Thêm cell\n\n- **Toolbar**: bấm `Code` hoặc `Markdown` → thêm bên dưới cell đang chọn.\n- **Divider**: hover vào khoảng trống giữa 2 cell → hiện `+ Code` / `+ Text`.\n- Phím tắt: `Ctrl+Z` / `Ctrl+Shift+Z` để undo/redo cấu trúc."),
      md("## Di chuyển & xóa\n\nHover lên cell → action toolbar hiện phía trên cell:\n\n| Nút | Hành động |\n|---|---|\n| ↑ / ↓ | Di chuyển lên/xuống |\n| ⧉ | Nhân bản |\n| 🗑 | Xóa |\n| T | Chuyển Code ↔ Markdown |"),
      md("## Undo / Redo cấu trúc\n\n- Nút **↶ ↷** trên toolbar hoặc `Ctrl+Z` / `Ctrl+Shift+Z`\n- Undo/redo **thêm/xóa/di chuyển/đổi loại** cell\n- Lịch sử 100 bước; gõ liên tục trong 1 cell gộp 1 bước"),
      code("for i in range(5):\n    print(f'Cell {i+1}: sẵn sàng!')"),
    ],
  },

  // ── 3. Web Viewer ──────────────────────────────────────────────────────────
  "xem-notebook-learn": {
    title: "Xem notebook trên /learn",
    cells: [
      md("# Web Viewer — `/learn/[slug]`\n\nSau khi admin xuất bản, notebook xuất hiện ở `/learn/[slug]` cho người học."),
      md("## Layout\n\n```\n┌─────────────────────────┬──────────────┐\n│  Tiêu đề                │              │\n│  [Tutorial] [Exercise]  │  TOC sidebar │\n├─────────────────────────┤  (sticky,    │\n│  Kernel bar             │   scroll-spy)│\n├─────────────────────────┤              │\n│  Cells                  │  ▌ Mục 1    │\n│                         │    Mục 2    │\n└─────────────────────────┴──────────────┘\n```"),
      md("## TOC Sidebar\n\n- Tự extract heading `#` / `##` / `###` từ markdown cells\n- **Scroll-spy**: mục đang xem được highlight\n- Click → scroll mượt đến section\n- Ẩn mobile, hiện từ `lg` (1024px)"),
      md("## Tutorial & Exercise Tabs\n\n- **Tutorial**: nội dung bài học chính\n- **Exercise**: notebook bài tập (slug: `{slug}-exercise`)\n- Chưa có exercise → tab vẫn hiện placeholder \"coming soon\"\n- Nút **Your turn** nổi dưới phải → click chuyển Exercise tab"),
      code("print('Web viewer + kernel = notebook tương tác!')\nprint('TOC sidebar hiện bên phải (màn hình >= 1024px)')"),
    ],
  },

  // ── 4. Chạy code & Run All ────────────────────────────────────────────────
  "chay-code-run-all": {
    title: "Chạy code cell & Run All",
    cells: [
      md("# Chạy Code Cell & Run All\n\nKernel là tiến trình Python thật chạy trong Docker."),
      md("## Chạy từng cell\n\n- Bấm **▷** (tròn, bên trái cell) → chạy cell đó\n- `Shift+Enter` → chạy và chuyển xuống cell tiếp theo\n- Output stream **real-time** (từng dòng print hiện ngay)"),
      md("## Run All\n\n- Bấm **Run All** → chạy toàn bộ code cell từ trên xuống\n- Số **In [N]** cho biết thứ tự thực thi"),
      code("import time\n\nprint('Bắt đầu...')\nfor i in range(1, 6):\n    time.sleep(0.3)\n    print(f'Bước {i}/5 — streaming real-time!')\nprint('Xong!')"),
      md("## Kernel status\n\n| Màu | Nghĩa |\n|---|---|\n| 🟢 xanh | idle — sẵn sàng |\n| 🟡 nhấp nháy | starting |\n| 🟡 tĩnh | busy — đang chạy |\n| 🔴 đỏ | error |"),
    ],
  },

  // ── 5. Interrupt & Restart ────────────────────────────────────────────────
  "interrupt-restart-kernel": {
    title: "Interrupt & Restart kernel",
    cells: [
      md("# Interrupt & Restart Kernel"),
      md("## Interrupt — Dừng cell đang chạy\n\n- Bấm **⏹ Dừng** khi kernel đang `busy`\n- Tương đương `Ctrl+C` trong terminal\n- Biến đã tính **vẫn còn** trong bộ nhớ"),
      code("import time\n# Chạy cell này rồi bấm Interrupt\nprint('Bắt đầu vòng lặp...')\nfor i in range(9999):\n    print(f'  {i}', end='\\r')\n    time.sleep(0.1)"),
      md("## Restart — Reset toàn bộ kernel\n\n- Bấm **⟳ Restart** → kernel mới, **xóa toàn bộ biến**\n- Output đã render vẫn hiển thị\n- Dùng trước \"Run All\" để đảm bảo kết quả nhất quán"),
      code("try:\n    print(bien_chua_khai_bao)\nexcept NameError:\n    print('Biến chưa khai báo — kernel đã restart!')"),
    ],
  },

  // ── 6. Biểu đồ Matplotlib ─────────────────────────────────────────────────
  "bieu-do-matplotlib": {
    title: "Biểu đồ Matplotlib",
    cells: [
      md("# Biểu đồ Matplotlib\n\nOutput hình ảnh PNG — vẽ biểu đồ và thấy ngay trong cell."),
      md("## Cách hoạt động\n\n1. Cell chạy matplotlib\n2. Kernel render figure → **PNG base64**\n3. Proxy gửi về browser qua WebSocket (giới hạn 64 MB)\n4. Browser hiển thị ảnh trong cell output"),
      code("import matplotlib.pyplot as plt\nimport numpy as np\n\nx = np.linspace(0, 2 * np.pi, 200)\n\nfig, axes = plt.subplots(1, 2, figsize=(10, 4))\n\naxes[0].plot(x, np.sin(x), color='#6366f1', linewidth=2, label='sin(x)')\naxes[0].plot(x, np.cos(x), color='#f59e0b', linewidth=2, label='cos(x)')\naxes[0].set_title('Hàm lượng giác')\naxes[0].legend()\naxes[0].grid(alpha=0.3)\n\naxes[1].bar(['A', 'B', 'C', 'D'], [23, 45, 12, 67],\n            color=['#6366f1','#8b5cf6','#a78bfa','#c4b5fd'])\naxes[1].set_title('Bar Chart')\naxes[1].grid(axis='y', alpha=0.3)\n\nplt.tight_layout()\nplt.show()"),
      code("import matplotlib.pyplot as plt\nimport numpy as np\n\nnp.random.seed(42)\nn = 300\nx = np.random.randn(n)\ny = 2 * x + np.random.randn(n) * 0.8\n\nplt.figure(figsize=(7, 5))\nplt.scatter(x, y, c=np.abs(x + y), cmap='viridis', alpha=0.7, s=40)\nplt.colorbar(label='|x + y|')\nplt.title('Scatter plot')\nplt.tight_layout()\nplt.show()"),
    ],
  },

  // ── 7. Xử lý lỗi & traceback ─────────────────────────────────────────────
  "xu-ly-loi-traceback": {
    title: "Xử lý lỗi & traceback",
    cells: [
      md("# Xử Lý Lỗi & Traceback\n\nKhi code lỗi, notebook hiển thị traceback có màu ANSI với nền đỏ nhạt."),
      md("## Đọc traceback\n\n- `----> N` chỉ đúng **dòng lỗi**\n- Tên lỗi (NameError, TypeError…) ở cuối\n- ANSI color: đỏ = lỗi path, xanh = frame code"),
      code("# NameError — biến chưa khai báo\nprint(bien_chua_khai_bao)"),
      code("# TypeError — sai kiểu\nresult = '10' + 10"),
      code("# ZeroDivisionError\ndef tinh_trung_binh(lst):\n    return sum(lst) / len(lst)\n\nprint(tinh_trung_binh([]))"),
      md("## Sửa lỗi\n\n1. Đọc `----> N` → biết dòng lỗi\n2. Sửa code trong cell\n3. Chạy lại (`Shift+Enter`)\n4. Lỗi do biến từ cell trước → **Restart + Run All**"),
    ],
  },

  // ── 8. Markdown syntax highlight ──────────────────────────────────────────
  "markdown-syntax-highlight": {
    title: "Markdown với syntax highlight",
    cells: [
      md("# Markdown Cells với Syntax Highlight\n\nDùng **CodeMirror 6** khi edit — heading/bold/code được highlight ngay khi gõ."),
      md("## Cách dùng\n\n1. Click markdown cell đang render → **edit mode**\n2. Gõ markdown — highlight hiện ngay\n3. Preview song song ở nửa phải (màn hình ≥ md)\n4. `Shift+Enter` hoặc **Đóng** → render\n\n**Toolbar định dạng**: H B *I* `<>` 🔗 📷 ❝ ≡ 1."),
      md("## Ví dụ\n\n**Đậm**, *nghiêng*, `inline code`\n\n```python\ndef chao(ten):\n    return f'Xin chào, {ten}!'\n```\n\n> Blockquote\n\n- Danh sách\n- không thứ tự"),
      code("# Code cell thực thi; markdown cell hiển thị văn bản.\nprint('Markdown render đẹp, code cell chạy Python!')"),
    ],
  },

  // ── 9. Code cell & phím tắt ──────────────────────────────────────────────
  "code-cell-phim-tat": {
    title: "Code cell & phím tắt",
    cells: [
      md("# Code Cell & Phím Tắt\n\nCodeMirror 6 với Python syntax highlight, auto-indent và bracket matching."),
      md("## Phím tắt trong cell\n\n| Phím | Hành động |\n|---|---|\n| `Shift+Enter` | Chạy → xuống cell tiếp |\n| `Tab` | Indent |\n| `Ctrl+/` | Toggle comment |\n| `Ctrl+Z` | Undo text |"),
      md("## Phím tắt cấu trúc (ngoài cell)\n\n| Phím | Hành động |\n|---|---|\n| `Ctrl+Z` | Undo cấu trúc |\n| `Ctrl+Shift+Z` | Redo cấu trúc |\n\n⚠️ Undo text (trong cell) và undo cấu trúc là **hai hệ thống riêng**."),
      code("data = [1, 2, 3, 4, 5]\ntong = sum(data)\ntb = tong / len(data)\nprint(f'Tổng: {tong}, Trung bình: {tb}')"),
      md("## Accent bar & selection UI\n\n- Cell selected → **thanh xanh** bên trái (Colab style)\n- `ring-2` + `shadow` khi selected\n- Hover → viền mờ hiện\n- Action toolbar (↑↓⧉🗑T) chỉ hover hoặc code cell selected"),
    ],
  },

  // ── 10. Xuất bản notebook ────────────────────────────────────────────────
  "xuat-ban-notebook": {
    title: "Xuất bản notebook",
    cells: [
      md("# Xuất Bản Notebook\n\nXuất bản = cho người dùng web truy cập notebook qua `/learn/[slug]`."),
      md("## Quy trình\n\n1. Chỉnh sửa notebook trong Admin\n2. Bấm **Xuất bản** (góc phải toolbar)\n3. Popover hiện:\n   - Xác nhận notebook đang public\n   - URL `/learn/[slug]` — click để select, bấm 📋 copy\n   - Nút **Hủy xuất bản** để gỡ\n\n```\n┌───────────────────────────────────┐\n│ 🌐 Notebook đang hiển thị công khai│\n│ ┌─────────────────────────┐  📋   │\n│ │ localhost:3000/learn/.. │       │\n│ └─────────────────────────┘       │\n│ [       Hủy xuất bản       ]      │\n└───────────────────────────────────┘\n```"),
      md("## Lưu ý\n\n- Slug không thay đổi được sau tạo\n- Published notebook: API không cần auth\n- Draft: chỉ admin xem\n- Thay đổi sau publish → autosave → **cập nhật ngay** trên /learn"),
      code("print('Notebook đã được xuất bản!')\nprint('Truy cập: http://localhost:3000/learn/xuat-ban-notebook')"),
    ],
  },

  // ── 11. Tạo exercise ────────────────────────────────────────────────────
  "tao-exercise-nguoi-hoc": {
    title: "Tạo exercise cho người học",
    cells: [
      md("# Tạo Exercise Notebook\n\nExercise là notebook companion — hiển thị ở **Tab Exercise** trên `/learn`."),
      md("## Convention slug\n\n```\nTutorial slug:  python-co-ban\nExercise slug:  python-co-ban-exercise\n```\n\nWeb tự load `{slug}-exercise` từ kernel-server."),
      md("## Quy trình\n\n1. Admin → `/notebooks` → Tạo notebook `{tutorial-slug}-exercise`\n2. Soạn bài tập:\n   - Markdown giải thích yêu cầu\n   - Code cell `# YOUR CODE HERE`\n   - Code cell kiểm tra\n3. **Xuất bản** → Tab Exercise tự kích hoạt!\n\n```\n┌─────────┐┌──────────┐\n│ Tutorial ││ Exercise │  ← kích hoạt khi có {slug}-exercise\n└─────────┘└━━━━━━━━━━┘\n│ ## Bài tập 1: ...   |\n│ [ ]: # YOUR CODE    |\n└─────────────────────┘\n```"),
      code("# Ví dụ cell bài tập\ndef giai_thua(n):\n    # YOUR CODE HERE\n    pass\n\n# Test tự động\nassert giai_thua(5) == 120, 'Sai! Giai thừa 5 = 120'\nassert giai_thua(0) == 1,   'Sai! Giai thừa 0 = 1'\nprint('✅ Chính xác!')"),
    ],
  },
}

async function put(slug, nb) {
  const body = {
    title: nb.title,
    published: true,
    runtimeProfile: "data-science",
    notebook: {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
        language_info: { name: "python" },
        title: nb.title,
      },
      cells: nb.cells,
    },
  }
  const res = await fetch(`${BASE}/api/notebooks/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
}

async function main() {
  console.log(`Seeding ${Object.keys(notebooks).length} platform notebooks → ${BASE}`)
  for (const [slug, nb] of Object.entries(notebooks)) {
    try {
      await put(slug, nb)
      console.log(`  ✓ ${slug}`)
    } catch (err) {
      console.error(`  ✗ ${slug}: ${err.message}`)
    }
  }
  console.log("Done.")
}

main()
