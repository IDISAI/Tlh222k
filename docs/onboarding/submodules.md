# Git Submodules

Repo này tách một số phần code ra **repo riêng** và tham chiếu bằng git submodule. Tài liệu này giải thích cách clone, cập nhật, chỉnh sửa, và **cách tự thêm một submodule mới** theo đúng quy trình đã dùng (không mất code).

---

## Các submodule hiện có

| Path trong repo cha | Repo con |
|---------------------|----------|
| `packages/ui` | `git@github.com:IDISAI/ui.git` |
| `packages/core/src/roadmap` | `git@github.com:IDISAI/roadmap.git` |

Định nghĩa nằm trong [`.gitmodules`](../../.gitmodules).

---

## Clone repo (lần đầu)

```bash
git clone --recurse-submodules git@github.com:IDISAI/Tlh222k.git
```

Nếu đã lỡ clone không kèm submodule:

```bash
git submodule update --init --recursive
```

> Thiếu submodule = thư mục rỗng → **build vỡ**: `web` phụ thuộc `@workspace/ui`, và `packages/core/src/index.ts` re-export `./roadmap`.

---

## Cập nhật submodule về commit mới nhất mà repo cha ghim

```bash
git submodule update --init --recursive
```

Kéo bản mới nhất từ nhánh `main` của repo con (rồi nhớ commit gitlink ở repo cha nếu muốn ghim):

```bash
git submodule update --remote --merge
```

---

## Chỉnh sửa code trong submodule

Submodule là **repo độc lập** — sửa code là commit trong repo con trước:

```bash
cd packages/ui
git checkout main                 # submodule thường ở detached HEAD sau update
# ... sửa code ...
git add -A && git commit -m "fix: ..."
git push origin main

cd ../..                          # về repo cha
git add packages/ui               # ghim con trỏ (gitlink) sang commit mới
git commit -m "chore: bump ui submodule"
git push
```

Bỏ bước cuối = repo cha vẫn trỏ commit cũ, người khác không thấy thay đổi.

---

## Thêm một submodule MỚI (quy trình thủ công, không mất code)

`git submodule add` **fail** nếu path đã tồn tại trong index, và nếu repo con rỗng nó sẽ **ghi đè** thư mục hiện tại bằng nội dung rỗng. Vì vậy khi tách một thư mục đang có code, làm theo thứ tự sau.

Ví dụ tách `packages/ui` ra repo `git@github.com:IDISAI/ui.git`:

```bash
# 0. Tạo repo rỗng trên GitHub trước (có thể chỉ có README).

# 1. Đẩy nội dung HIỆN CÓ lên repo con trước (chỉ file đã track, bỏ node_modules)
tmp=$(mktemp -d)
git clone git@github.com:IDISAI/ui.git "$tmp"
git archive HEAD:packages/ui | tar -x -C "$tmp"     # trải subtree đang track vào clone
cd "$tmp"
git add -A && git commit -m "feat: import ui from monorepo"
git push origin main
cd -    # về repo cha
rm -rf "$tmp"

# 2. Gỡ path khỏi repo cha (index + working tree)
git rm -r --cached packages/ui
rm -rf packages/ui

# 3. Thêm submodule — nó clone lại đúng nội dung vừa push
git submodule add git@github.com:IDISAI/ui.git packages/ui

# 4. Cài lại + verify build không vỡ, rồi commit
pnpm install
pnpm typecheck && pnpm build
git add .gitmodules packages/ui
git commit -m "chore: extract packages/ui into submodule"
git push
```

**Điểm mấu chốt:** bước 1 (push nội dung cũ lên trước) là thứ giữ cho code không bị xoá. Bỏ nó đi và repo con đang rỗng → submodule kéo về README rỗng, mất sạch code.

Với submodule lồng sâu (vd `packages/core/src/roadmap`) thì y hệt, chỉ đổi path và URL.

---

## Xoá một submodule

```bash
git submodule deinit -f packages/ui
git rm -f packages/ui
rm -rf .git/modules/packages/ui
git commit -m "chore: remove ui submodule"
```

---

## Liên quan

- [Kiến trúc](./architecture.md) · [CI/CD](./cicd.md) · [Quy tắc packages](../../rules/packages.md)
