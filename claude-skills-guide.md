# Claude Code — Skills đang thật sự dùng

Bản rút gọn, chỉ giữ skill đã xác nhận dùng (đã bỏ Design/UI, Figma, iOS, file Office docx/pdf/pptx/xlsx, automation/schedule/canary/retro, và các skill lẻ chưa xác nhận).

---

## 1. Planning & Review (pipeline spec → ship)

| Skill                | Dùng khi                                                                                         | Input → Output                |
| -------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| `spec`               | Biến ý tưởng mơ hồ thành spec/issue backlog-ready, 5 phase                                       | Ý tưởng/brief → spec chi tiết |
| `plan-ceo-review`    | Review chiến lược/scope theo góc CEO                                                             | Spec/plan → góp ý chiến lược  |
| `plan-eng-review`    | Review kiến trúc theo góc eng manager                                                            | Spec/plan → góp ý kỹ thuật    |
| `plan-design-review` | Review plan theo con mắt designer                                                                | Spec/plan → góp ý UX          |
| `plan-devex-review`  | Review plan theo góc DX                                                                          | Spec/plan → góp ý DX          |
| `autoplan`           | Chạy tự động cả 4 review trên tuần tự, tự quyết theo 6 nguyên tắc                                | Spec/plan → báo cáo tổng hợp  |
| `review`             | Review PR trước khi land                                                                         | Diff → nhận xét               |
| `code-review`        | Review theo 2 trục Standards + Spec từ 1 điểm cố định (commit/branch/tag), 2 sub-agent song song | Diff → báo cáo 2 trục         |
| `ship`               | Merge base branch, chạy test, review diff, bump VERSION, CHANGELOG, commit, push, tạo PR         | Code sẵn sàng → PR live       |

**Pipeline:**

```
spec (spec chi tiết)
   → autoplan (hoặc từng plan-*-review riêng)
      → code
         → code-review / review
            → ship
```

---

## 2. Debug & QA

| Skill             | Dùng khi                                               |
| ----------------- | ------------------------------------------------------ |
| `investigate`     | Debug có hệ thống, tìm root cause                      |
| `diagnosing-bugs` | Vòng lặp chẩn đoán cho bug khó/regression hiệu năng    |
| `qa`              | QA toàn diện web app + **tự fix** bug tìm thấy         |
| `qa-only`         | Chỉ báo cáo bug, không tự fix                          |
| `tdd`             | Test-first (red-green-refactor), viết integration test |
| `security-review` | Review bảo mật cho thay đổi pending trên branch        |

**Pipeline:**

```
investigate / diagnosing-bugs (tìm nguyên nhân)
   → tdd (viết test cho bug)
      → fix code
         → qa-only (báo cáo, không sửa) hoặc qa (tự fix)
            → security-review (nếu chạm auth/input)
               → code-review → ship
```

---

## 3. Codebase Memory / Knowledge Graph / gbrain

| Tool/Skill         | Dùng khi                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| `search_graph`     | Tìm function/class/route theo tên/label/qualified-name pattern               |
| `trace_path`       | Truy call chain (calls / data_flow / cross_service)                          |
| `get_code_snippet` | Lấy source chính xác của 1 symbol                                            |
| `query_graph`      | Query Cypher phức tạp                                                        |
| `get_architecture` | Cấu trúc project                                                             |
| `search_code`      | Text search có graph hỗ trợ (grep tăng cường)                                |
| `index_repository` | Chạy trước nếu project chưa được index                                       |
| `setup-gbrain`     | Cài CLI gbrain, khởi tạo brain local (PGLite/Supabase), đăng ký MCP          |
| `sync-gbrain`      | Đồng bộ gbrain với repo hiện tại + cập nhật hướng dẫn search trong CLAUDE.md |

**Quy tắc:** mọi task tìm-hiểu-code ưu tiên `search_graph`/`trace_path`/`search_code` TRƯỚC Grep/Glob/Read.

---

## 4. Caveman suite (style + commit + subagent)

| Skill                      | Dùng khi                                                                          |
| -------------------------- | --------------------------------------------------------------------------------- |
| `caveman:caveman`          | Đổi mức độ caveman: lite/full/ultra/wenyan                                        |
| `caveman:caveman-help`     | Xem nhanh mọi lệnh/mode caveman                                                   |
| `caveman:caveman-init`     | Gắn rule caveman always-on vào repo cho mọi IDE agent                             |
| `caveman:caveman-compress` | Nén file memory (CLAUDE.md, todo, preference) sang caveman, backup `.original.md` |
| `caveman:caveman-stats`    | Token đã dùng thực tế + tiết kiệm trọn đời + quy USD                              |
| `caveman:caveman-commit`   | Sinh commit message ngắn kiểu caveman                                             |
| `caveman:caveman-review`   | Review code 1-dòng-mỗi-nhận-xét                                                   |
| `caveman:cavecrew`         | Quyết định khi nào nên spawn subagent caveman thay vì làm inline/`Explore`        |

**Subagent liên quan** (gọi qua `Agent`, không qua `Skill`):

- `cavecrew-investigator`: định vị code read-only, trả file:line.
- `cavecrew-builder`: sửa 1-2 file, cơ học. Từ chối scope ≥3 file.
- `cavecrew-reviewer`: review diff/branch/file, 1 dòng/finding.

---

## 5. Browser / scrape misc

| Skill                   | Dùng khi                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| `browse`                | Headless browser nhanh để QA/dogfood site                              |
| `scrape`                | Kéo dữ liệu từ 1 trang web                                             |
| `skillify`              | Đóng gói flow `/scrape` vừa thành công thành 1 browser-skill vĩnh viễn |
| `setup-browser-cookies` | Import cookie từ Chromium thật vào session browse headless             |
| `open-gstack-browser`   | Mở GStack Browser (Chromium AI-controlled, có sẵn sidebar extension)   |
| `pair-agent`            | Pair 1 remote AI agent với browser của bạn                             |

---

## 6. Vercel suite

| Skill                                                                                                                                                                                                                                                              | Dùng khi                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `vercel:bootstrap`                                                                                                                                                                                                                                                 | Bootstrap repo với resource Vercel-linked: preflight, provision integration, verify env |
| `vercel:deploy`                                                                                                                                                                                                                                                    | Deploy project hiện tại ("prod" = production, mặc định preview)                         |
| `vercel:env` / `vercel:env-vars`                                                                                                                                                                                                                                   | Quản lý env var: list/pull/add/remove/diff                                              |
| `vercel:marketplace`                                                                                                                                                                                                                                               | Tìm/cài integration Marketplace (DB, CMS, auth...)                                      |
| `vercel:status`                                                                                                                                                                                                                                                    | Trạng thái project: deploy gần đây, env overview                                        |
| `vercel:deployments-cicd`                                                                                                                                                                                                                                          | Chiến lược deploy, CI/CD, preview URL, promote production, rollback                     |
| `vercel:knowledge-update`                                                                                                                                                                                                                                          | Sửa kiến thức lỗi thời về platform Vercel                                               |
| `vercel:ai-sdk` / `vercel:ai-gateway`                                                                                                                                                                                                                              | Build tính năng AI: chat, agent, tool-calling, MCP, streaming, model routing            |
| `vercel:chat-sdk`                                                                                                                                                                                                                                                  | Chat bot đa nền tảng (Slack/Telegram/Teams/Discord...) 1 codebase                       |
| `vercel:auth`                                                                                                                                                                                                                                                      | Tích hợp auth: Clerk/Descope/Auth0 trên Next.js                                         |
| `vercel:microfrontends`                                                                                                                                                                                                                                            | Multi-zone, microfrontends.json, routing xuyên project                                  |
| `vercel:next-cache-components`                                                                                                                                                                                                                                     | PPR, `use cache`, cacheLife/cacheTag/updateTag                                          |
| `vercel:next-forge`                                                                                                                                                                                                                                                | Monorepo SaaS starter next-forge                                                        |
| `vercel:next-upgrade`                                                                                                                                                                                                                                              | Nâng cấp Next.js theo migration guide + codemod                                         |
| `vercel:nextjs`                                                                                                                                                                                                                                                    | Kiến trúc/debug Next.js App Router nói chung                                            |
| `vercel:react-best-practices`                                                                                                                                                                                                                                      | Checklist chất lượng sau khi sửa nhiều file `.tsx`                                      |
| `vercel:routing-middleware`                                                                                                                                                                                                                                        | Routing Middleware framework-agnostic                                                   |
| `vercel:shadcn` / `vercel:runtime-cache` / `vercel:turbopack` / `vercel:vercel-agent` / `vercel:vercel-cli` / `vercel:vercel-connect` / `vercel:vercel-firewall` / `vercel:vercel-functions` / `vercel:vercel-storage` / `vercel:verification` / `vercel:workflow` | Hướng dẫn chuyên biệt theo tên chủ đề tương ứng                                         |
| `vercel:vercel-sandbox`                                                                                                                                                                                                                                            | Chạy code không tin cậy trong Firecracker microVM                                       |

**Pipeline deploy chuẩn:**

```
vercel:bootstrap (lần đầu setup)
   → vercel:env (đồng bộ biến môi trường)
      → vercel:deploy (preview)
         → vercel:deployments-cicd (promote production / rollback)
```

---

## 7. Documentation & Context

| Skill             | Dùng khi                                     |
| ----------------- | -------------------------------------------- |
| `context-save`    | Lưu working context hiện tại                 |
| `context-restore` | Khôi phục context đã lưu bởi `/context-save` |

**Pipeline:** làm dở → `context-save` → (phiên sau) `context-restore` → tiếp tục.

---

## 8. Matt Pocock skills (repo-local, `.claude/skills/`)

Bộ skill riêng của repo (mattpocock/skills), đã setup qua `setup-matt-pocock-skills` — config nằm ở `docs/agents/issue-tracker.md` (GitHub `IDISAI/Tlh222k`), `triage-labels.md` (5 role chuẩn), `domain.md` (single-context: `CONTEXT.md` + `docs/adr/`).

| Skill                      | Dùng khi                                                                                                       | Input → Output                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `setup-matt-pocock-skills` | Scaffold/đổi lại config issue-tracker, triage label, domain docs cho repo                                      | — → `docs/agents/*.md` + block `## Agent skills` trong CLAUDE.md     |
| `ask-matt`                 | Không biết skill nào phù hợp tình huống — router qua toàn bộ skill trong repo                                  | Tình huống mô tả → gợi ý skill/flow                                  |
| `grill-me`                 | Hỏi xoáy liên tục để mài sắc 1 plan/design                                                                     | Plan thô → plan đã bị stress-test                                    |
| `grill-with-docs`          | Như `grill-me`, đồng thời tạo ADR + glossary trong lúc hỏi                                                     | Plan thô → plan sắc + `CONTEXT.md`/`docs/adr/` cập nhật              |
| `to-spec`                  | Biến hội thoại hiện tại thành spec, publish thẳng lên tracker — không phỏng vấn, chỉ tổng hợp                  | Hội thoại đã bàn xong → issue spec trên GitHub                       |
| `to-tickets`               | Chẻ 1 plan/spec/hội thoại thành các "tracer-bullet ticket", khai báo blocking edge, publish lên tracker        | Plan/spec → nhiều issue con có quan hệ block-by                      |
| `triage`                   | Đưa issue/PR ngoài qua state machine: phân loại, verify, grill nếu cần, viết brief sẵn cho agent               | Issue thô → issue đã gắn nhãn (`needs-triage`→...→`ready-for-agent`) |
| `wayfinder`                | Lập kế hoạch việc lớn (hơn 1 phiên agent chịu nổi) thành bản đồ ticket quyết định trên tracker, giải quyết dần | Việc lớn → map issue + child ticket, giải từng cái tới đích          |
| `handoff`                  | Nén hội thoại hiện tại thành tài liệu bàn giao cho agent khác                                                  | Hội thoại dài → 1 file handoff                                       |
| `implement`                | Implement code dựa trên 1 spec hoặc bộ ticket có sẵn                                                           | Spec/ticket → code                                                   |
| `teach`                    | Dạy user 1 skill/khái niệm mới trong phạm vi workspace                                                         | Câu hỏi → giải thích + ví dụ trong workspace                         |
| `writing-great-skills`     | Tham khảo khi viết/sửa skill mới cho đúng chuẩn (vocab, nguyên tắc dễ đoán)                                    | —                                                                    |

**Pipeline issue-tracker đầy đủ (repo này dùng GitHub):**

```
wayfinder (việc lớn → map + child ticket)
   hoặc
to-spec (hội thoại → spec) / to-tickets (plan → nhiều ticket)
      → triage (phân loại, gắn label needs-triage → ready-for-agent/ready-for-human)
         → implement (ticket → code)
            → code-review / review → ship
```

Không biết bắt đầu từ đâu → `ask-matt` trước. Cần mài plan trước khi lên ticket → `grill-me`/`grill-with-docs` trước `to-spec`/`to-tickets`. Hết context giữa chừng → `handoff`.

---

## 9. Sơ đồ pipeline tổng hợp (end-to-end 1 feature)

```
spec (spec chi tiết)
   → autoplan (review CEO+design+eng+DX)
      → tdd (viết test trước)
         → code (implement)
            → investigate / diagnosing-bugs (nếu kẹt bug)
               → qa-only / qa
                  → security-review (nếu chạm auth/input)
                     → code-review / review
                        → ship
                           → vercel:deploy → vercel:deployments-cicd
```

Nhánh phụ:

- Tìm hiểu code trước khi sửa: `search_graph` / `trace_path` / `search_code` (mục 3).
- Lưu/khôi phục context giữa phiên: `context-save` ↔ `context-restore`.
- Việc nhỏ 1-2 file / review nhanh: spawn `cavecrew-builder` / `cavecrew-reviewer` (mục 4) thay vì làm inline, tiết kiệm token.

---

### Đã bỏ khỏi danh sách (không dùng)

Design/UI (`design-consultation`, `design-html`, `design-review`, `ui-ux-pro-max`, `dataviz`, `diagram`, `prototype`), Figma suite (toàn bộ), iOS suite (toàn bộ), file Office (`docx`, `pdf`, `pptx`, `xlsx`, `make-pdf`), automation/monitoring (`loop`, `schedule`, `morning`, `canary`, `retro`, `benchmark`, `benchmark-models`), domain/system phụ (`domain-modeling`, `codebase-design`, `grilling`, `research`, `resolving-merge-conflicts`, `simplify`, `health`, `devex-review`, `land-and-deploy`, `landing-report`, `setup-deploy`, `freeze`, `unfreeze`, `guard`, `careful`, `document-generate`, `document-release`, `init`, `learn`, `gstack-upgrade`, `cso`, `codex`, `office-hours`, `plan-tune`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `claude-api`, `run`, `skill-creator`, `consolidate-memory`, `setup-cowork`).
