# Quy trình làm việc hàng ngày

Hướng dẫn này giải thích mọi thứ bạn làm mỗi ngày: nhận task, viết code, commit, mở PR và merge vào codebase.

---

## Tại sao dùng GitFlow?

lh222k dùng **Full GitFlow** thay vì GitHub Flow đơn giản hơn.

**GitHub Flow** (chỉ `main` + feature branches) phù hợp với team deploy liên tục mà không cần staging. lh222k cần:

1. **Môi trường staging** để team test trước khi lên production
2. **Release có phiên bản** (`v1.0.0`, `v1.1.0`) với changelog rõ ràng
3. **Hotfix** không làm gián đoạn các tính năng đang phát triển

GitFlow giải quyết cả ba: `develop` → staging, `release/*` → chuẩn bị production, `hotfix/*` → fix khẩn cấp mà không ảnh hưởng `develop`.

---

## Hai nhánh tồn tại lâu dài

| Nhánh     | Tương ứng với | Push trực tiếp?  | Merge từ đâu?               |
| --------- | ------------- | ---------------- | --------------------------- |
| `main`    | Production    | ❌ Không bao giờ | `release/*` hoặc `hotfix/*` |
| `develop` | Staging       | ❌ Không bao giờ | `feature/*` qua PR          |

```
main      ──────────────────────────────────→  (production)
develop   ──────────────────────────────────→  (staging)
               ↑                     ↑
          feature/them-tinh-nang  feature/sua-loi
```

> **Quy tắc vàng:** Bạn KHÔNG BAO GIỜ push trực tiếp lên `main` hoặc `develop`. Luôn qua PR.

---

## Lifecycle của một tính năng thông thường

### Bước 1 — Tạo nhánh mới từ `develop`

```bash
git checkout develop
git pull origin develop         # đảm bảo bạn đang ở trạng thái mới nhất
git checkout -b feature/ten-tinh-nang
```

Quy tắc đặt tên: `feature/<mô-tả-ngắn-gọn>`, luôn dùng lowercase kebab-case.

```
✅ feature/lesson-crud
✅ feature/fix-graph-drop
❌ feature/LessonCRUD
❌ feature/them tinh nang moi
```

### Bước 2 — Code và commit theo Conventional Commits

Định dạng: `<type>: <mô tả>` — không viết hoa chữ đầu, không dấu chấm cuối.

| Type       | Khi nào dùng                        | Ví dụ tốt                                           |
| ---------- | ----------------------------------- | --------------------------------------------------- |
| `feat`     | Tính năng mới                       | `feat: add lesson title inline editor`              |
| `fix`      | Sửa lỗi                             | `fix: node drop broken on canvas edge`              |
| `chore`    | Bảo trì, dependencies               | `chore: update prisma to 6.x`                       |
| `refactor` | Tái cấu trúc không thay đổi hành vi | `refactor: extract graph save logic to service`     |
| `test`     | Thêm hoặc sửa tests                 | `test: add unit tests for roadmap resolver`         |
| `docs`     | Chỉ thay đổi tài liệu               | `docs: update getting-started with SSH alternative` |
| `ci`       | Thay đổi GitHub Actions             | `ci: fix pnpm version in deploy workflow`           |

**Ví dụ commit tốt vs xấu:**

```
✅ feat: add dark mode toggle to graph toolbar
✅ fix: prevent duplicate node creation on double-click
✅ refactor: move roadmap service to feature-first structure

❌ Updated stuff
❌ fix
❌ feat: Added a new feature for users to be able to toggle dark mode
   (quá dài, viết hoa, có dấu chấm ngầm)
```

### Bước 3 — Chạy tests trước khi push

```bash
# Chạy tất cả unit tests (không bao gồm E2E)
pnpm test

# Chỉ test package đang làm việc
pnpm --filter @vizteck/admin test
pnpm --filter @vizteck/core test
pnpm --filter @vizteck/api-gateway test

# Kiểm tra TypeScript (giống pnpm lint trên CI)
pnpm lint
```

Nếu pass trên máy local, sẽ pass trên CI. Đừng push code khi tests đang fail.

### Bước 4 — Push và mở Pull Request

```bash
git push origin feature/ten-tinh-nang
```

Vào GitHub → repo → "Compare & pull request". Cấu hình:

- **Base:** `develop`
- **Compare:** `feature/ten-tinh-nang`
- **Title:** Conventional Commit format (ví dụ: `feat: add lesson title editor`)
- **Description:** Mô tả WHAT và WHY, không mô tả HOW (code đã làm điều đó)

**PR checklist trước khi mở:**

- [ ] `pnpm test` pass trên máy local
- [ ] `pnpm lint` pass (không có TypeScript errors)
- [ ] Code được review bởi chính bạn lần cuối (xóa `console.log`, code thừa, comment tạm thời)
- [ ] Base branch là `develop`, không phải `main`
- [ ] PR title theo Conventional Commits format

### Bước 5 — CI chạy tự động

Sau khi push, GitHub Actions tự động chạy `lint → test → build`. **PR không thể merge khi CI chưa pass.**

Nếu CI fail:

- Click vào link CI trong PR để xem log
- Fix issue trên branch của bạn
- Push lại — CI sẽ tự chạy lại

### Bước 6 — Code review

Reviewer sẽ để comment trên GitHub. Sau khi review:

- **Resolve conversation** sau khi bạn fix từng comment
- Không tự merge trước khi reviewer approve

### Bước 7 — Merge vào `develop`

Sau khi CI pass và được approve, merge PR vào `develop`. CI/CD sẽ tự động deploy lên **Vercel Staging**.

---

## Lifecycle của hotfix (lỗi khẩn cấp trên production)

Hotfix bỏ qua `develop` và đi **thẳng từ `main`** vì `develop` có thể đã có code chưa được test kỹ.

```bash
# Bước 1 — Branch từ main, KHÔNG phải develop
git checkout main
git pull origin main
git checkout -b hotfix/fix-loi-dang-nhap

# Bước 2 — Fix, test, commit
pnpm test   # phải pass
git commit -m "fix: prevent crash on login when token is empty"
git push origin hotfix/fix-loi-dang-nhap

# Bước 3 — Mở 2 PR: hotfix → main, hotfix → develop
# PR 1: hotfix/fix-loi-dang-nhap → main (ưu tiên merge trước)
# PR 2: hotfix/fix-loi-dang-nhap → develop (để đồng bộ)

# Sau khi merge vào main:
git checkout main
git tag v1.0.1      # tăng PATCH version
git push origin main v1.0.1   # kích hoạt deploy production
```

Hotfix LUÔN tăng PATCH version (`v1.0.0` → `v1.0.1`).

---

## Lifecycle của release (lead làm)

Release gom nhiều tính năng đã merge vào `develop` để đưa lên production cùng lúc.

```bash
# Bước 1 — Tạo release branch từ develop
git checkout develop
git pull origin develop
git checkout -b release/1.1.0

# Bước 2 — Chỉ được commit bugfix tại đây
# KHÔNG thêm tính năng mới vào release branch
git commit -m "chore: bump version to 1.1.0"

# Bước 3 — Mở 2 PR:
# PR 1: release/1.1.0 → main
# PR 2: release/1.1.0 → develop

# Bước 4 — Sau khi merge PR vào main:
git checkout main
git tag v1.1.0
git push origin main v1.1.0    # kích hoạt pipeline release.yml → production

# Bước 5 — Đồng bộ về develop
git checkout develop
git merge --no-ff release/1.1.0
git push origin develop

# Dọn dẹp release branch
git branch -d release/1.1.0
git push origin --delete release/1.1.0
```

---

## Sơ đồ tổng quan GitFlow

```
main      ─────────────────────────────────────────────────→
            ↑ merge        ↑ hotfix merge   ↑ release merge
         hotfix/x        hotfix/x        release/1.1.0

develop   ─────────────────────────────────────────────────→
            ↑ PR merge     ↑ PR merge    ↑ (sync từ release)
         feature/A     feature/B      release/1.1.0 →→ main
```

---

## Những điều tuyệt đối không làm

```
❌ git push origin main       → push thẳng vào main
❌ git push -f origin develop → force push vào develop
❌ Mở PR base vào main thay vì develop
❌ Merge PR khi CI chưa pass
❌ Merge PR trước khi được approve
❌ Commit thẳng vào develop thay vì dùng feature branch
```

---

## Cập nhật database schema

Khi bạn thay đổi `packages/db/prisma/schema.prisma`:

```bash
# Trong quá trình phát triển local (không tạo migration file)
DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/lh222k" pnpm --filter @vizteck/db db:push

# Khi sẵn sàng commit thay đổi schema
DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/lh222k" pnpm --filter @vizteck/db db:migrate
```

**Quy tắc:** Luôn commit migration files trong cùng PR với code sử dụng schema mới. Không bao giờ commit migration file riêng lẻ.

---

## Common mistakes của developer mới

| Lỗi                                                    | Hậu quả                                      | Cách tránh                                          |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| Tạo branch từ `main` thay vì `develop`                 | Bỏ lỡ các tính năng mới nhất trên `develop`  | Luôn `git checkout develop` trước                   |
| Push thẳng vào `develop`                               | Bỏ qua CI và code review                     | Dùng feature branch + PR                            |
| Commit message không theo Conventional Commits         | Release notes tự động sẽ lộn xộn             | Xem bảng commit types ở trên                        |
| Merge khi CI đang fail                                 | Bug lọt vào staging                          | Đợi CI pass, fix nếu cần                            |
| Thêm logic vào `packages/graph` hoặc `packages/lesson` | Vi phạm kiến trúc — hai packages đó là shims | Đặt logic trong `packages/core`, shim chỉ re-export |

---

## Liên quan

- [Tổng quan kiến trúc](./architecture.md) — tại sao dùng GitFlow
- [CI/CD Pipeline](./cicd.md) — mỗi hành động Git kích hoạt pipeline nào
- [Kiểm thử](./testing.md) — cách viết và chạy tests
