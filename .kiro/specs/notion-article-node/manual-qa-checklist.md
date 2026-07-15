# Hướng dẫn kiểm tra — Notion Article Node

Checklist kiểm tra thủ công cho toàn bộ tính năng. Đánh ✅/❌ vào từng dòng.

## 0. Chuẩn bị (chạy 1 lần)

```bash
pnpm install
pnpm -F @workspace/db generate
pnpm -F @workspace/db db:push        # đồng bộ schema (linkedRoadmapId, isPublished)
pnpm dev                             # web :3000, admin :3002, svc :3005
```

- [ ] 3 server chạy (`:3000`, `:3002`, `:3005`).
- [ ] Đăng nhập admin (`http://localhost:3002/roadmaps`) — role phải là `admin`/`super-admin`.
- [ ] **Nếu đổi `schema.graphql`**: restart svc-roadmap thủ công (NestJS không tự reload file `.graphql`).
- [ ] Sau mỗi lần sửa code UI: **hard-reload (Ctrl+Shift+R)**.

Lưu ý: header admin phải hiện avatar (UserButton) mà **không** crash "Clerk was not loaded with Ui components". Nếu crash → chưa nhận bản fix, hard-reload.

---

## 1. Double-click Article Notion Node → mở workspace (Req 1)

- [ ] Trên canvas, tạo/mở 1 article node loại **Notion** đã có trang.
- [ ] **Double-click** node → `NodeDetailDialog` (sidebar phải) hiện, rồi tự điều hướng đến `/notion/{chapterSlug}?page={articleSlug}`.
- [ ] Node Notion **chưa** có trang (`notionPageId` null): nút "Điều hướng" mờ, click → toast "Trang Notion chưa được tạo cho node này".
- [ ] Double-click node role/skill/chapter/jupyter: mở dialog như cũ, **không** tự điều hướng đến Notion.

## 2. Tạo Article Notion Node → tự tạo Document (Req 2)

- [ ] Chuột phải canvas → tạo node `article` + chọn loại tài liệu **Notion** + nhập tiêu đề.
- [ ] Node tạo xong → tự động mở `/notion/{chapter}?page={slug}` để soạn ngay.
- [ ] Trong workspace: trang mới **nằm trong cây sidebar dưới chapter** (không mồ côi).
- [ ] Node trên canvas có badge **Notion** (đã liên kết, không còn cảnh báo tam giác vàng).
- [ ] Tạo node article Notion mà **không có** chapter cha: vẫn tạo Document nhưng không tự điều hướng.

## 3. Đồng bộ Title 2 chiều (Req 3)

- [ ] Sửa title node trong `NodeEditPanel` (Chỉnh sửa) → lưu → mở workspace, title trang Notion **đã đổi theo**.
- [ ] Sửa title trang trong workspace (gõ vào ô tiêu đề) → chờ ~0.5s → quay lại canvas, title node **đã đổi theo**.

## 4. Tạo trang trong sidebar Notion → tạo node canvas (Req 4)

- [ ] Trong workspace, click **"Trang mới"** dưới chapter root → 1 node article Notion mới xuất hiện trên canvas (parent = chapter).
- [ ] Click "+" (Thêm trang con) dưới 1 **article** đã có node → node mới trên canvas parent = article đó.
- [ ] Tạo sub-page dưới 1 trang **không có node tương ứng** (trang con sâu) → chỉ tạo Document, **không** tạo node.

## 5. Deep-link mở đúng trang (Req 5)

- [ ] Mở URL `/notion/{chapter}?page={articleSlug}` trực tiếp → workspace mở, trang được chọn sẵn + **cuộn tới** trong sidebar (highlight).
- [ ] `?page=slug-không-tồn-tại` → fallback (web: "Nội dung không khả dụng"; admin: root doc).

## 6. Viewer zone read-only (Req 6) — web `:3000`

- [ ] `/roadmap/{slug}` (roadmap đã publish) → click article Notion node → điều hướng `/notion/{chapter}?page={slug}`.
- [ ] Node Notion **chưa liên kết**: mờ 50%, con trỏ cấm, không click được.
- [ ] Workspace web (`canEdit=false`): **không** có nút "Trang mới", "Thùng rác", slash menu, block toolbar, drag handle.
- [ ] Trang **chưa publish** → "Nội dung không khả dụng", không lộ trang khác.

## 7. Đồng bộ Publish (Req 7)

- [ ] `NodeEditPanel` của article Notion có toggle **"Xuất bản"**.
- [ ] Bật toggle → lưu → trên web zone trang đó hiển thị (đã publish).
- [ ] Tắt toggle → lưu → web zone trang đó về "Nội dung không khả dụng".

## 8. Xóa node giữ Document (Req 8)

- [ ] "Xóa khỏi Canvas" (trong dialog) → node biến khỏi canvas, Document **vẫn còn** (mở lại workspace thấy trang).
- [ ] Xóa vĩnh viễn qua Kho Node (sidebar trái) → node mất hẳn + Document liên kết bị **archive** (vào Thùng rác).

## 9. Slug (Req 9)

- [ ] Tạo node tiêu đề tiếng Việt "Lập trình Web" → slug = `lap-trinh-web`.
- [ ] Tạo 2 node trùng tên → slug thứ 2 có đuôi `-2`.
- [ ] Đổi title node → **slug KHÔNG đổi** (mở lại vẫn link đúng).
- [ ] (Tự động) `pnpm -F @workspace/core test` → 22 test pass.

## 10. Chapter Node → Roadmap Detail Page (Req 10)

- [ ] Double-click **chapter node** → dialog → "Điều hướng" → vào `/roadmaps/{id}/chapter/{slug}`.
- [ ] Trang có: sidebar trái (danh sách node con), canvas giữa (chapter + con, depth 1), sidebar phải (properties khi chọn node).
- [ ] Double-click article Notion trong canvas này → tự điều hướng workspace (như Req 1).
- [ ] Slug chapter sai trong URL → thông báo lỗi + link "Quay về Builder".

## 11. Thêm Role/Skill Node → tạo Roadmap (Req 11)

- [ ] Tạo node **role** hoặc **skill** trên canvas → 1 Roadmap mới tự tạo (`isPublished=false`).
- [ ] Vào danh sách `/roadmaps` → thấy roadmap mới.
- [ ] "Điều hướng" trên role/skill node đã liên kết → vào builder của roadmap đó.
- [ ] Node role/skill chưa liên kết → toast "Node này chưa được liên kết với roadmap nào."

## 12. Block Types trong Editor (Req 12)

Gõ `/` trong editor, kiểm tra tạo được từng block:

- [ ] `/heading` (H1/H2/H3), `/paragraph`
- [ ] `/bullet`, `/numbered`, `/check` (to-do)
- [ ] `/quote`, `/divider`, `/toggle`
- [ ] `/callout` (đổi emoji khi click icon)
- [ ] `/column` (chia 2-3 cột) — **hoặc** kéo 1 block sang cạnh phải block khác để tạo cột
- [ ] `/image`, `/video`, `/audio`, `/file`, `/table`
- [ ] `/embed` (dán URL YouTube/Figma → hiện iframe)
- [ ] `/code` → **có syntax highlight** + chọn được ngôn ngữ (JS/TS/Python/HTML/CSS/SQL/JSON/Bash)
- [ ] `/link` (Link to page) → chọn trang → chip click được, mở trang đó
- [ ] Gõ `@` → mention: chọn **trang** (chip click mở trang), hoặc **Hôm nay / Ngày mai / Hôm qua**
- [ ] Kéo block (tay cầm 6 chấm) đổi vị trí; menu tay cầm có Duplicate / Delete
- [ ] `Tab` / `Shift+Tab` trên list → indent/outdent
- [ ] Đổi loại block (transform) giữ nguyên text

## 13. Tổ chức trang (bonus — nesting)

- [ ] Menu "..." trên 1 trang trong sidebar → **"Chuyển vào trang khác"** → picker.
- [ ] Chọn 1 trang đích → trang được lồng vào làm con của trang đó.
- [ ] Chọn "Chuyển lên cấp cao nhất" → trang về cấp cao nhất của chapter.
- [ ] Kéo trang trong cùng cấp → đổi thứ tự (reorder).

---

## Đã biết / ngoài phạm vi

- **Upload ảnh bìa fail** ("Tải ảnh bìa thất bại"): `BLOB_READ_WRITE_TOKEN` trên Vercel hết hạn/sai — lỗi env, không phải code. Check Vercel Dashboard → Storage.
- Columns dùng `@blocknote/xl-multi-column` (license **AGPL-3.0**).

## Nếu gặp lỗi

1. Crash "Clerk was not loaded" → hard-reload; nếu còn, xóa `.next`: `rm -rf apps/*/.next` rồi `pnpm dev` lại.
2. Field GraphQL thiếu (`linkedRoadmapId`/`isPublished`) → restart svc-roadmap.
3. Trang builder treo skeleton → mở DevTools → Network, xem request `graphql` (pending/đỏ?), gửi ảnh.
