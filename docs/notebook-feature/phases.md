# Notebook feature — per-phase UI/UX verification mockups

ASCII acceptance checklists. When verifying a phase, open the matching screen and
confirm every element and state shown here (including the transient states:
running spinners, streamed output, error tracebacks, ✅/❌ check results).
See [prompt.md](prompt.md) for the full build spec.

---

## Phase 1 — Viewer in `apps/web` (`/learn/[slug]`)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  [🔍 Search........................................................]      (o)  │
│                                                                                 │
│  Arithmetic and Variables                                              ⋮        │
│  ┌─────────┐┌──────────┐                                                        │
│  │ Tutorial ││ Exercise │   ← 2 tab; Tutorial active (gạch chân đậm)            │
│  └━━━━━━━━━┘└──────────┘                                                        │
├──────────────────────────────────────────────────────┬─────────────────────────┤
│                                                      │  Arithmetic             │
│  ## Debugging                          ← markdown    │  Comments               │
│                                                      │  Variables              │
│  One common error ... `hours_per_day` ...            │    Creating variables   │
│                                                      │    Manipulating vars    │
│  In [13]: ┌────────────────────────────────────┐     │    Using multiple vars  │
│           │ print(hours_per_dy)   ← highlight  │     │  ▌ Debugging ← active   │
│           └────────────────────────────────────┘     │  What's next?           │
│           ┌────────────────────────────────────┐     │                         │
│           │▒▒ NameError            Traceback ▒▒│     │  (TOC sticky, scroll-   │
│           │▒▒ ----> 1 print(hours_per_dy)    ▒▒│     │   spy đổi mục active)   │
│           │▒▒ NameError: name 'hours_per_dy' ▒▒│     │                         │
│           │▒▒ is not defined                 ▒▒│     │                         │
│           └────────────────────────────────────┘     │                         │
│            ▒▒ = nền đỏ nhạt, ANSI color parsed       │                         │
│                                                      │                         │
│  In [14]: ┌────────────────────────────────────┐     │                         │
│           │ print(hours_per_day)               │     │                         │
│           └────────────────────────────────────┘     │                         │
│           24                    ← plain output       │                         │
│                                                      │                         │
│  ## What's next?                                     │                         │
│  Now it's your turn to [practice manipulating...]    │                         │
│                                       ┌──────────────────────────────────┐     │
│                                       │ 📓  Your turn                    │     │
│                                       │     Try the exercise: Arithmetic │     │
│                                       │     and Variables                │     │
│                                       │        [Not now] [Start Exercise]│     │
│                                       └──────────────────────────────────┘     │
│                                        ← card nổi góc phải dưới                │
└────────────────────────────────────────────────────────────────────────────────┘

Click [Start Exercise] → chuyển tab Exercise (Phase 1 hiện placeholder):
┌─────────┐┌──────────┐
│ Tutorial ││ Exercise │
└─────────┘└━━━━━━━━━━┘
│   🚧 Exercise coming soon (Phase 3)   │

Roadmap integration: click node type "jupyter" trong /roadmap/[slug]
  → điều hướng sang /learn/[notebookSlug] (KHÔNG mở Notion drawer)
```

---

## Phase 2 — Admin editor (`localhost:3002/notebooks/[id]`), chưa có execution

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Exercise: Arithmetic and Variabl...   Draft saved ←autosave    [Share][Save Ver]│
│ File  Edit  View  Run  Settings  Help                                           │
├────────────────────────────────────────────────────────────────────────────────┤
│ [+ ▾] [✂][⧉][📋]  [▷ Run All(disabled: "kernel: Phase 3")]  [Markdown ▾]  ⟳ ⋮ │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ┌──────────┐  │
│  ┃ ## Set up the notebook          ← markdown cell SELECTED  ┃   │ ↑  ↓  🗑 │  │
│  ┃ To begin, run the code in the next cell.                  ┃   └──────────┘  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ← viền xanh   │
│     [+ Code] [+ Markdown]     ← nút chèn hiện giữa 2 cell khi hover             │
│  [ ]: ┌──────────────────────────────────────────────────────┐                 │
│       │ # Set up the exercise            ← CodeMirror 6,     │                 │
│       │ from learntools.core import binder   có highlight    │                 │
│       │ binder.bind(globals())                khi gõ         │                 │
│       └──────────────────────────────────────────────────────┘                 │
│  (double-click markdown cell → edit; Esc/blur → preview lại)                    │
│  Phím tắt: Shift+Enter=advance  A/B=chèn trên/dưới  DD=xoá  M/Y=đổi loại  Ctrl+Z│
└────────────────────────────────────────────────────────────────────────────────┘

Trang danh sách /notebooks:
┌───────────────────────────────────────────────┐
│  Notebooks                     [+ New notebook]│
│  ┌─────────────────────────────────────────┐  │
│  │ 📓 Arithmetic and Variables    ⋮ (xoá)  │  │
│  │    edited 2m ago · published ✓          │  │
│  │ 📓 Exercise: Arithmetic...   draft      │  │
│  └─────────────────────────────────────────┘  │
│  [↥ Upload .ipynb]                            │
└───────────────────────────────────────────────┘

Phân quyền: token user thường → API notebooks 403;
            web chỉ GET /notebooks/published/:slug → 200
```

---

## Phase 3a — Admin editor với kernel thật

```
Toolbar khi có kernel (phải thấy đủ 3 state indicator):
  [▷ Run] [▷▷ Run All] [⏹ Interrupt] [⟳ Restart]   ● idle / ◐ busy / ○ reconnecting

Cell đang chạy — output stream theo thời gian thực:
  In [*]: ┌──────────────────────────────────────────┐   ← [*] = đang chạy
          │ for i in range(5):                       │
          │     print(i); time.sleep(1)              │
          └──────────────────────────────────────────┘
          0
          1
          2█            ← từng dòng hiện dần, KHÔNG đợi chạy xong

Chạy xong: In [1]: ... (execution_count được gán)

stdin: In [*]: name = input("Your name: ")
       Your name: ┌─────────────────┐ [↵]   ← ô nhập hiện dưới cell
```

## Phase 3b — Tab Exercise ở `apps/web` (Pyodide, user thường)

```
┌─────────┐┌──────────┐
│ Tutorial ││ Exercise │            Progress: [██████░░░░] 3/5 questions
└─────────┘└━━━━━━━━━━┘
├────────────────────────────────────────────────────────────────────┤
│ ⚫ Session off (run a cell to start)          ← trước khi boot      │
│  [ ]: │ print("Hello, world!")                                     │
│       │ q1.check()                                                 │
│  Chạy cell đầu: ◌ Starting Python... (~3-5s)  ← Pyodide boot 1 lần  │
│  In [1]:  Hello, world!                                             │
│       ┌─────────────────────────────────────────┐  ← q1.check() ok │
│       │ ✅ Correct!                              │                   │
│       └─────────────────────────────────────────┘                   │
│  Sai:  ┌─────────────────────────────────────────┐                  │
│        │ ❌ Incorrect: expected `pi = 3.14159`,   │                  │
│        │    hint: use round(number, 5)           │                  │
│        └─────────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────┘

Verify an toàn: DevTools Network khi chạy cell → KHÔNG có request thực thi nào
                (chỉ có lần tải pyodide.wasm đầu tiên từ CDN);
                non-admin gọi API kernel của kernel-server → 403
```
