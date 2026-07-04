# Tối ưu & giảm token cho Claude Code

> File **tham khảo**, KHÔNG auto-load mỗi session (khác `CLAUDE.md`).
> Đọc khi cần. Bản thân file này không tốn token định kỳ.

## Nguyên tắc gốc
Mỗi lượt trả lời, Claude đọc lại TOÀN BỘ context đang mở (system prompt +
CLAUDE.md + plugin/MCP + lịch sử hội thoại). Giảm token = giảm cái được nạp
mỗi lượt, không phải giảm số chữ bạn gõ.

## Việc tác động lớn nhất → nhỏ nhất

### 1. Quản lý hội thoại
- `/clear` khi đổi task. Context cũ vẫn tính tiền dù không liên quan.
- `/compact` khi hội thoại dài — nén thành tóm tắt.
- Một session = một task. Đừng gộp nhiều việc khác nhau.
- `/context` để xem cái gì đang chiếm chỗ.

### 2. Cắt cái auto-load
- **CLAUDE.md gọn.** Nạp MỖI session. Chỉ giữ lệnh + quy ước hay quên.
  Chi tiết dài → tách ra file trong `docs/` và chỉ link tới.
- **Gỡ plugin / MCP / skill không dùng** trong `~/.claude/settings.json`.
  Mỗi cái thêm mô tả vào context mọi lúc.
- MCP server tốn nhất: mỗi server nạp toàn bộ schema tool vào context.
  Chỉ bật khi đang dùng.

### 3. Chọn model theo việc — `/model`
- Haiku: đọc file, sửa nhỏ, hỏi đáp, tra cứu.
- Sonnet: code thường ngày.
- Opus: kiến trúc, debug phức tạp, refactor lớn.

### 4. Prompt caching (tự động, không cần cấu hình)
- Giữ khoảng cách giữa các lượt < 5 phút → cache còn "nóng" → lượt sau rẻ.
- Nghỉ lâu → cache hết hạn → phải đọc lại từ đầu (đắt + chậm).

### 5. Cách viết prompt
- Chỉ đích danh file: "sửa `apps/web/lib/core.ts`" thay vì "tìm chỗ xử lý core".
- Chia nhỏ task, xong thì `/clear`.
- Yêu cầu ngắn khi cần: "trả lời ngắn, không giải thích dài".
- Tránh bắt Claude đọc file lớn toàn bộ; chỉ định đoạn cần.

### 6. Subagent — dùng có chọn lọc
Mỗi subagent khởi động lại từ đầu, đọc lại context → tốn nhất. Chỉ dùng cho
việc song song thực sự độc lập, hoặc tìm kiếm fan-out cần kết luận chứ không
cần nội dung file.

## Checklist nhanh (3 việc nếu chỉ làm được 3)
1. `/clear` giữa các task.
2. Gỡ plugin/MCP/skill không dùng khỏi settings.
3. Rút gọn CLAUDE.md, đẩy chi tiết sang docs/.
