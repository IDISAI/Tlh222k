# Prompt: Build Notion.so clone from zero (paste vào Claude Fable 5, repo TRỐNG)

> Copy toàn bộ phần dưới đường kẻ vào session Fable 5 mới. Prompt đúc kết mọi bài học
> từ lần build trước trong repo lh222k (2026-07-04).

---

Bạn là Senior Full-Stack Engineer. Xây dựng một bản clone **Notion.so** end-to-end, production-ready, trong repo trống này — **toàn bộ trong MỘT lần giao duy nhất, không chia phase**. Tự chủ hoàn toàn và **tuyệt đối không báo "xong" khi chưa tự verify bằng chạy thật**.

## Nguyên tắc làm việc (bắt buộc)

1. **Hỏi tôi TẤT CẢ credentials cần thiết NGAY TIN NHẮN ĐẦU TIÊN** (LIVEBLOCKS_SECRET_KEY, DATABASE_URL Neon nếu deploy, BLOB/UPLOADTHING token, VERCEL_TOKEN…) rồi mới bắt đầu — vì làm một mạch nên không được dừng giữa chừng để chờ secret. Cái nào tôi chưa đưa thì đánh dấu tính năng đó là "chờ credential" trong báo cáo cuối, phần còn lại vẫn phải hoàn chỉnh.
2. **Verify bằng browser thật (Playwright) ở ĐÚNG URL người dùng sẽ mở, kèm SCREENSHOT** — không chỉ curl API, không chỉ typecheck/build xanh. Bài học thật: từng có bản pass hết gates + API hoạt động nhưng UI trần trụi vì CSS không được compile — chỉ screenshot mới lộ ra.
3. Commit git theo từng checkpoint nội bộ (schema xong, backend xong, editor xong…) để không mất việc khi có sự cố — nhưng **giao hàng và báo cáo đúng một lần** khi tất cả xong.
4. Báo cáo trung thực: fail thì nói fail kèm log; tính năng nào chưa chạy được thì ghi rõ, không im lặng bỏ qua.
5. Không phá data: không bao giờ `--accept-data-loss`, không đụng bảng không thuộc project này.

## Môi trường máy tôi (Windows) — bẫy ĐÃ GẶP, phải né từ đầu

- Windows 11 + PowerShell; Node ≥ 20; **pnpm 10**: thêm ngay `pnpm.onlyBuiltDependencies: ["prisma", "@prisma/client", "@prisma/engines", "esbuild"]` vào package.json gốc, không thì postinstall bị chặn.
- **Docker daemon không chạy** — đừng chờ `docker compose`. Postgres có sẵn ở `localhost:5432` (user `vizteck`/`vizteck`), user này **không có quyền CREATEDB** → `prisma migrate dev` fail P3014 (shadow database). Local dùng `prisma db push`; migration files sinh trên Neon khi deploy. Database `vizteckstack` đang chứa data của project khác ở schema `public` và schema `notion` → dùng PostgreSQL **schema riêng mới** (vd `?schema=notion2`).
- **Prisma 7**: config qua `prisma.config.ts` (nhớ `import "dotenv/config"` — .env không còn tự load); generator `prisma-client` output TS vào `generated/` (gitignore); runtime dùng driver adapter `@prisma/adapter-pg` — adapter **không hiểu `?schema=` trong URL**, phải parse URL và truyền `{ schema }` vào `new PrismaPg(connString, { schema })`. Thêm `"postinstall": "prisma generate"` vào packages/db để Vercel/CI fresh clone tự có client.
- Terminal Windows **mangle tiếng Việt qua curl** → mọi test có nội dung tiếng Việt làm qua browser hoặc Python (build chuỗi từ codepoint), không curl chuỗi Việt.
- Dev server trên Windows: process con hay bị **orphan giữ port** (EADDRINUSE — tệ hơn: zombie serve CODE CŨ khiến verify sai) → trước khi start/restart luôn kill listener theo port (`Get-NetTCPConnection -LocalPort <port>` → `Stop-Process`).
- **Tailwind v4**: `@source` trong globals.css **không tự scan packages ngoài thư mục app** — package nào chứa component phải có dòng `@source` tương ứng, và phải verify bằng screenshot (đây chính là bug "UI trần" lần trước).
- **BlockNote**: client-only — load qua `next/dynamic` với `ssr: false`; `initialContent` không được là mảng rỗng (truyền `undefined` nếu trống); `key={pageId}` để remount editor khi đổi trang.

## Tech stack (chốt cứng, không tự đổi)

- Monorepo **Turborepo + pnpm** (`apps/*`, `packages/*`; packages không bao giờ import apps). **Không dùng git submodule.**
- Frontend: **Next.js App Router bản mới nhất** (create-next-app chuẩn), TypeScript, Tailwind v4, **shadcn/ui là ưu tiên số 1 cho MỌI UI component** — init shadcn từ Phase 0; sidebar, dialog, dropdown-menu, context-menu, command (⌘K search palette), button, input, tooltip, popover, skeleton… đều lấy từ shadcn; chỉ tự viết markup khi shadcn không có component tương ứng. Icons: lucide-react. Server state: **@apollo/client** với typed documents từ @graphql-codegen (không dùng TanStack Query). Editor: **BlockNote** (`@blocknote/react` + `@blocknote/mantine`).
- Backend: service per-feature **`apps/svc-notion`** — **Hono** + **Apollo Server** tại `/graphql` (Apollo Sandbox làm IDE; **GraphQL là đường data THẬT duy nhất** client↔server) + **`@hono/zod-openapi`** Swagger tại `/docs` (**REST chỉ là contract trả mock data** — không đụng DB). **@graphql-codegen** từ MỘT file `schema.graphql` sinh typed resolvers (server) + typed documents cho **@apollo/client** (frontend) — sửa schema sai là typecheck gãy cả hai đầu. **Clean Architecture 4 layers**: `domain/` (entities + repository ports, zero dependency) → `application/` (use-cases, chỉ phụ thuộc domain) → `infrastructure/` (Prisma repositories implement ports) → `interface/` (GraphQL resolvers + REST mock); `container.ts` là composition root duy nhất. CORS `credentials:true` cho các origin frontend.
- DB: `packages/db` — Prisma 7 + PostgreSQL, client singleton qua globalThis.
- Auth: **Auth.js v5 (Credentials + bcrypt, JWT session) ngay từ Phase 1** — không làm demo user; svc-notion verify JWT trên mọi request và lấy userId từ đó.
- Realtime: **Liveblocks** (+ Yjs cho BlockNote collab). **Không** socket.io tự host, **không** gRPC — Vercel không hỗ trợ.
- Upload: Vercel Blob (hoặc UploadThing nếu tôi đưa token — hỏi tôi ở phase 6).
- Deploy: Vercel — mỗi app một project (Root Directory = thư mục app), GitHub Actions matrix; svc-notion cần env `DATABASE_URL` + `CORS_ORIGINS`. **Không Multi-Zones** cho tới phase cuối; nếu unify domain thì là phase riêng và phải verify asset từng zone bằng screenshot.

## Schema Prisma (dùng thiết kế đã kiểm chứng này)

- Auth.js models (`User`/`Account`/`Session`/`VerificationToken`) + `User.passwordHash`.
- `Workspace`, `WorkspaceMember` (role `OWNER|ADMIN|MEMBER|GUEST`, unique `[workspaceId, userId]`).
- `Page`: tree qua `parentId` (self-relation, onDelete Cascade), `title`, `icon`, `coverUrl`, `content Json` (BlockNote blocks — block id ổn định để comment anchor), `properties Json` (khi page là row của database), `rank String` (fractional index cho thứ tự siblings), `visibility WORKSPACE|PRIVATE`, `isPublic` (share link), `deletedAt` (trash), `createdById`; index `[workspaceId, parentId]`, `[workspaceId, deletedAt]`.
- `Database` (pageId unique; `propertySchema Json`: `[{id, name, type: text|number|select|multiSelect|date|person|checkbox|url|relation|rollup|formula, options?}]`) + `DatabaseView` (`type TABLE|BOARD|LIST|CALENDAR|GALLERY`, `config Json {filters, sorts, groupBy, hiddenProperties}`, `rank`). **Rows = child Pages** của page-database, giá trị nằm trong `properties`.
- `Comment` (`blockId?` anchor block, `parentId?` thread, `resolvedAt?`), `Favorite` (unique `[userId, pageId]`, `rank`), `PageVersion` (snapshot `title`+`content`).

## Scope — làm HẾT trong một lần giao, không chia phase

Toàn bộ các mục sau đều phải hoàn thành:

1. **Nền tảng**: scaffold monorepo + `packages/db` (schema đầy đủ) + shadcn init + CI GitHub Actions (lint→typecheck→build); `prisma db push` thành công vào schema mới.
2. **Auth**: Auth.js v5 Credentials — đăng ký/đăng nhập/đăng xuất qua browser; svc-notion verify JWT mọi request write.
3. **Backend `svc-notion`** (Clean Architecture): workspaces + pages CRUD (tree/move/trash/restore/purge) + databases/views + comments + favorites + versions + search; Swagger `/docs` + GraphQL `/graphql` sống.
4. **UI chính**: app shell shadcn (sidebar tree, **⌘K command palette** cho search, dark mode) + **BlockNote editor** autosave debounce + title/icon; slash menu, sub-page, favorite, trash/restore hoạt động.
5. **Databases UI**: table view + board view; editor propertySchema; filter/sort/group từ view config; row mở được thành trang đầy đủ.
6. **Chia sẻ & tổ chức**: public share link (`/p/[pageId]`) read-only, favorites section, trash purge.
7. **Cộng tác**: comments (anchor block, thread, resolve); realtime Liveblocks (presence + Yjs collab) — nếu tôi đã đưa key ở đầu, bắt buộc chạy; chưa đưa thì code sẵn, gắn cờ "chờ credential".
8. **Nâng cao**: page history (versions + restore), templates, export Markdown + PDF (print CSS), upload ảnh cover/inline (Blob/UploadThing nếu có token).

**Definition of Done tổng (một lần duy nhất, cuối cùng):**
- `pnpm lint` + `pnpm typecheck` + `pnpm build` xanh toàn repo.
- Click-through bằng Playwright + screenshot cho TỪNG mục scope trên (đăng ký → login → tạo page → gõ nội dung → F5 còn nguyên → database lọc `status=Done` đúng row → share link ẩn danh read-only → 2 tab collab thấy nhau (nếu có key) → restore version đúng nội dung).
- Một bảng **"Hướng dẫn kiểm tra thủ công"** tổng hợp (bước → kỳ vọng) phủ hết tính năng.
- Git history có các commit checkpoint rõ ràng.

## Output cuối cùng (một báo cáo duy nhất)

1. Tóm tắt cái gì ship + cấu trúc thư mục + file chính. 2. Bằng chứng verify (output lệnh + toàn bộ screenshots). 3. Bảng "Hướng dẫn kiểm tra thủ công" tổng hợp. 4. Danh sách trung thực: tính năng nào "chờ credential" hoặc còn nợ.

Bắt đầu ngay: tin nhắn đầu tiên chỉ hỏi credentials (mục Nguyên tắc #1), sau đó làm một mạch đến hết.
