# Git Hooks (Husky)

tlh222k dùng **Husky** để tự động kiểm tra code và format commit message mỗi khi bạn `git commit` hoặc `git push`. Tài liệu này giải thích hooks hoạt động như thế nào và cách xử lý khi chúng fail.

---

## Tại sao cần Git Hooks?

Không có hooks, lỗi TypeScript và commit message sai định dạng chỉ bị phát hiện khi **CI chạy trên GitHub** — nghĩa là sau khi bạn đã push code. Với hooks:

| Không có hooks                            | Có hooks                                     |
| ----------------------------------------- | -------------------------------------------- |
| Push → CI fail → phải fix → push lại      | Lỗi bị bắt ngay tại máy local trước khi push |
| Commit message sai → CI/Changelog lộn xộn | Commit message sai → bị từ chối ngay lập tức |
| TypeScript error chỉ thấy trên CI         | TypeScript error thấy ngay khi commit        |

---

## 3 Hooks đang hoạt động

### 1. `commit-msg` — Kiểm tra định dạng commit message

**Khi nào chạy:** Mỗi lần bạn gõ `git commit -m "..."`

**Làm gì:** Kiểm tra commit message theo định dạng **Conventional Commits**

**Định dạng bắt buộc:**

```
<type>: <mô tả ngắn gọn>
```

**Các type hợp lệ:**

| Type       | Ý nghĩa                         | Ví dụ                                       |
| ---------- | ------------------------------- | ------------------------------------------- |
| `feat`     | Tính năng mới                   | `feat: add lesson title inline editor`      |
| `fix`      | Sửa lỗi                         | `fix: node drop broken on canvas edge`      |
| `chore`    | Bảo trì, dependencies           | `chore: update prisma to 6.x`               |
| `refactor` | Tái cấu trúc, không đổi hành vi | `refactor: extract graph save to service`   |
| `test`     | Thêm hoặc sửa tests             | `test: add unit tests for roadmap resolver` |
| `docs`     | Chỉ thay đổi tài liệu           | `docs: update getting-started guide`        |
| `ci`       | Thay đổi GitHub Actions         | `ci: fix pnpm version in deploy workflow`   |

**Quy tắc:**

- Không viết hoa chữ đầu của mô tả: `feat: add X` ✅, `feat: Add X` ❌
- Không dấu chấm ở cuối: `feat: add X` ✅, `feat: add X.` ❌
- Tối đa 100 ký tự
- Phải có `type:` prefix

---

### 2. `pre-commit` — Lint + Test trước khi commit

**Khi nào chạy:** Sau khi bạn gõ `git commit`, TRƯỚC khi commit được tạo

**Làm gì:**

```
pnpm lint    → TypeScript type check toàn bộ project (4 apps)
pnpm test    → Chạy tất cả unit tests (Vitest + Jest)
```

**Thời gian:** ~30–60 giây (tùy máy)

Nếu lint hoặc test fail, commit bị **hủy** và bạn cần fix lỗi trước.

---

### 3. `pre-push` — Test trước khi push

**Khi nào chạy:** Khi bạn gõ `git push`

**Làm gì:** `pnpm test` — chạy tất cả unit tests lần nữa

Đây là lớp bảo vệ cuối cùng trước khi code lên remote.

---

## Setup cho developer mới

Husky được thiết lập tự động khi bạn chạy `pnpm install` — không cần làm gì thêm.

**Kiểm tra hooks đang hoạt động:**

```bash
git config core.hooksPath
# Kết quả mong đợi: .husky/_
```

Nếu không thấy `.husky/_`, chạy:

```bash
pnpm install    # prepare script sẽ khởi động husky tự động
```

---

## Ví dụ thực tế

### Commit hợp lệ ✅

```bash
git commit -m "feat: add dark mode toggle to graph toolbar"
# → commit-msg: PASS
# → pre-commit: lint OK, tests OK
# → Commit được tạo thành công
```

### Commit với message sai ❌

```bash
git commit -m "Added dark mode"
```

```
⧗   input: Added dark mode
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings

husky - commit-msg script failed (code 1)
```

**Fix:** Thêm đúng format:

```bash
git commit -m "feat: add dark mode toggle"
```

### Commit khi có TypeScript error ❌

```bash
git commit -m "feat: add new component"
```

```
> @vizteck/admin@0.0.1 lint
> tsc --noEmit

src/features/roadmaps/components/RoadmapCard.tsx(15,5): error TS2322:
  Type 'string' is not assignable to type 'number'.

 Tasks:    1 failed, 4 total
husky - pre-commit script failed (code 1)
```

**Fix:** Sửa TypeScript error, sau đó commit lại.

### Commit khi test fail ❌

```bash
git commit -m "fix: update roadmap service"
```

```
FAIL src/roadmap/roadmap.resolver.spec.ts
  ✕ roadmaps() returns array

Test Suites: 1 failed, 1 passed, 2 total
husky - pre-commit script failed (code 1)
```

**Fix:** Sửa test hoặc code cho test pass, rồi commit lại.

---

## Bỏ qua hooks (trường hợp khẩn cấp)

**Chỉ dùng khi thực sự cần thiết** — ví dụ: commit WIP để backup code trên máy khác khi đang trong quá trình sửa lỗi.

```bash
# Bỏ qua pre-commit và commit-msg
git commit --no-verify -m "wip: backup before refactor"

# Bỏ qua pre-push
git push --no-verify
```

> ⚠️ **Cảnh báo:** CI trên GitHub vẫn sẽ kiểm tra code. Nếu bạn push code lỗi, CI sẽ fail và PR không thể merge.

---

## Tắt hooks tạm thời

Nếu cần tắt toàn bộ hooks (không khuyến khích):

```bash
HUSKY=0 git commit -m "..."
HUSKY=0 git push
```

---

## Xử lý lỗi thường gặp

**`husky - pre-commit script failed` nhưng code đúng**

Có thể test fail do flaky test. Chạy lại thủ công:

```bash
pnpm test
```

Nếu pass thủ công nhưng fail trong hook, thử commit lại. Nếu vẫn fail, báo team.

**`pnpm: command not found` trong hook**

Husky không tìm thấy pnpm trong PATH. Fix:

```bash
# Đảm bảo pnpm đang trong PATH
which pnpm

# Nếu không có, cài lại:
npm install -g pnpm
```

**`hooks not working` sau khi clone repo lần đầu**

Chạy:

```bash
pnpm install   # prepare script khởi động husky
git config core.hooksPath   # kiểm tra .husky/_
```

**Hooks không chạy trên Windows**

Husky cần Git Bash. Đảm bảo Git đã cài đặt và đang dùng Git Bash (không phải CMD hay PowerShell thuần) để chạy git commands.

---

## Cấu trúc files

```
.husky/
  _/                 ← Git hooksPath (không chỉnh sửa trực tiếp)
    commit-msg       → delegate sang .husky/commit-msg
    pre-commit       → delegate sang .husky/pre-commit
    pre-push         → delegate sang .husky/pre-push
    h                → helper script của Husky
  commit-msg         ← bạn chỉnh sửa file này
  pre-commit         ← bạn chỉnh sửa file này
  pre-push           ← bạn chỉnh sửa file này

commitlint.config.cjs   ← rules kiểm tra commit message
```

---

## Thay đổi cấu hình hooks

**Thêm rule mới vào commitlint:**

Sửa `commitlint.config.cjs` ở root:

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", ["feat", "fix" /* thêm type mới ở đây */]],
  },
}
```

**Thêm lệnh vào pre-commit:**

Sửa `.husky/pre-commit`:

```bash
pnpm lint && pnpm test
# Thêm lệnh bên dưới nếu cần:
# pnpm format:check
```

---

## Liên quan

- [Quy trình làm việc hàng ngày](./daily-workflow.md) — Conventional Commits trong thực tế
- [CI/CD Pipeline](./cicd.md) — CI kiểm tra những gì sau khi push
- [Kiểm thử](./testing.md) — cách chạy và viết tests
