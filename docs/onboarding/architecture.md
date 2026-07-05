# Tổng quan kiến trúc

> **⚠️ Lưu ý trạng thái:** Tài liệu này mô tả **hệ thống mục tiêu (target architecture)** — bao gồm NestJS api-gateway, Prisma, PostgreSQL, packages/db, packages/graph, packages/lesson, apps/e2e. Các thành phần đó **chưa được build**.
>
> **Trạng thái hiện tại:** ba Next.js apps (`web`, `admin`, `super-admin`) + shared packages (`@workspace/core`, `@workspace/ui`). Xem [CLAUDE.md](../../CLAUDE.md) để biết trạng thái thực.
>
> Scope package là `@workspace/*` (không phải `@vizteck/*` như đề cập trong tài liệu này).

Tài liệu này giải thích **tại sao** lh222k được thiết kế theo cách hiện tại — không chỉ liệt kê công nghệ mà còn giải thích lý do lựa chọn, các phương án đã xem xét và sự đánh đổi.

---

## Mục lục

1. [Bức tranh tổng thể](#bức-tranh-tổng-thể)
2. [Tại sao dùng monorepo?](#tại-sao-dùng-monorepo)
3. [Hai frontend: web vs admin](#hai-frontend-web-vs-admin)
4. [API Gateway](#api-gateway)
5. [Cấu trúc feature-first trong admin](#cấu-trúc-feature-first-trong-admin)
6. [Shared packages](#shared-packages)
7. [Quy tắc phụ thuộc](#quy-tắc-phụ-thuộc)
8. [Data model](#data-model)
9. [Xác thực admin](#xác-thực-admin)
10. [Dark mode](#dark-mode)
11. [E2E testing](#e2e-testing)
12. [Luồng dữ liệu: xem roadmap](#luồng-dữ-liệu-xem-roadmap)
13. [Luồng dữ liệu: lưu nội dung lesson](#luồng-dữ-liệu-lưu-nội-dung-lesson)
14. [Tại sao dùng GitFlow?](#tại-sao-dùng-gitflow)

---

## Bức tranh tổng thể

lh222k là một **polyglot monorepo** — tất cả ứng dụng và thư viện dùng chung đều nằm trong một Git repository, nhưng mỗi app có thể dùng ngôn ngữ/framework khác nhau.

```
┌─────────────────────────────────────────────────────────┐
│                       TRÌNH DUYỆT                       │
│                                                         │
│  apps/web (:3001)          apps/admin (:3002)           │
│  Next.js 15 — SSG          Next.js 15 — CSR             │
│  Public roadmap viewer     Admin CMS + graph editor     │
└──────────────┬─────────────────────┬────────────────────┘
               │                     │
               │   HTTP (REST/GraphQL)│
               └──────────┬──────────┘
                           │
              ┌────────────▼──────────────┐
              │  apps/api-gateway (:3000) │
              │  NestJS                   │
              │  /graphql  (Apollo)       │
              │  /api/*    (REST)         │
              │  /api-docs (Swagger)      │
              │  AdminGuard (Bearer token)│
              └────────────┬──────────────┘
                           │
              ┌────────────▼──────────────┐
              │  packages/db              │
              │  Prisma ORM               │
              └────────────┬──────────────┘
                           │
              ┌────────────▼──────────────┐
              │  PostgreSQL (:5432)       │
              │  (Docker)                 │
              └───────────────────────────┘

apps/e2e — Playwright tests (chạy riêng, cần tất cả apps đang chạy)

packages/
  core    — nguồn sự thật duy nhất cho toàn bộ logic nghiệp vụ
  db      — Prisma client singleton + tất cả Prisma types
  ui      — React components dùng chung (Button, Card, NodeBadge)
  graph   — shim only — re-export từ @vizteck/core
  lesson  — shim only — re-export từ @vizteck/core
```

---

## Tại sao dùng monorepo?

### Vấn đề nếu không có monorepo

Hãy tưởng tượng `packages/core` nằm trong repo riêng. Khi bạn thêm một field mới vào shared type:

1. Commit và tạo PR cho repo `core`
2. Chờ PR merge, publish version mới
3. Vào repo `admin`, cập nhật dependency, import types mới
4. Vào repo `web`, làm lại bước 3
5. Phối hợp 3 PR để deploy đúng thứ tự

Với monorepo, tất cả chỉ là **một PR duy nhất**.

### pnpm workspaces

`pnpm workspaces` cho phép các packages trong monorepo import lẫn nhau như npm packages bình thường:

```typescript
// apps/admin/src/features/graph-editor/components/...
import { RoadmapGraph } from '@vizteck/graph';
import { Button } from '@vizteck/ui';
```

Không cần publish lên npm. pnpm tự liên kết (symlink) chúng.

### Turborepo

Turborepo giải quyết bài toán **thứ tự build**. Ví dụ: `apps/admin` phụ thuộc `packages/graph`, `packages/graph` phụ thuộc `packages/ui`. Turborepo tự hiểu thứ tự đó và:

- Build `packages/ui` → `packages/graph` → `apps/admin` đúng thứ tự
- **Cache** output: nếu `packages/ui` chưa thay đổi, không build lại
- Chạy các task song song khi có thể (ví dụ: build `packages/ui` và `packages/db` song song vì không phụ thuộc nhau)

Lệnh `pnpm build` ở root chạy Turborepo, không cần vào từng thư mục thủ công.

---

## Hai frontend: web vs admin

### Tại sao lại tách thành hai app?

`apps/web` và `apps/admin` đều là Next.js 15, nhưng có yêu cầu hoàn toàn khác nhau:

| Tiêu chí  | `apps/web` (:3001)                  | `apps/admin` (:3002)        |
| --------- | ----------------------------------- | --------------------------- |
| Đối tượng | Mọi người dùng internet             | Admin đã đăng nhập          |
| Rendering | Static (SSG) — build trước          | Client-side — fetch khi cần |
| SEO       | Quan trọng                          | Không cần                   |
| Xác thực  | Không cần                           | Bearer token bắt buộc       |
| Cache     | `no-store` — phản ánh ngay thay đổi | Real-time                   |

Nếu gộp thành một app, bạn phải auth-gate từng route, mix hai chiến lược render khác nhau trong cùng codebase, và xử lý edge case khi admin vô tình truy cập public page (hoặc ngược lại).

### apps/web — Public viewer

Là trang mà người học dùng. Chỉ hiển thị roadmaps có `status = PUBLIC`.

```
apps/web/src/
  app/
    page.tsx          — trang chủ, danh sách roadmaps
    roadmap/
      [slug]/page.tsx — xem roadmap theo slug
  features/
    roadmap/
      components/     — hiển thị danh sách roadmap
      services/       — gọi API để lấy dữ liệu roadmap
    lesson/
      components/     — hiển thị nội dung lesson
      services/       — gọi API để lấy nội dung lesson
```

Fetches dùng `{ cache: 'no-store' }` — cố ý để public viewer phản ánh ngay các thay đổi từ admin mà không cần rebuild toàn bộ site.

### apps/admin — CMS + Graph editor

Nơi admin tạo và quản lý nội dung. Yêu cầu `Authorization: Bearer <token>` cho mọi API call.

---

## API Gateway

### Tại sao cần API Gateway?

Không có api-gateway, `apps/web` và `apps/admin` sẽ phải:

- Kết nối thẳng đến database (không an toàn từ browser)
- Tự xử lý auth

API Gateway là **single entry point**: một URL duy nhất (`localhost:3000`) cho tất cả clients. Nó xử lý auth, routing REST/GraphQL, và gọi thẳng database qua Prisma.

```
admin/web → REST/GraphQL → api-gateway → Prisma → PostgreSQL
```

---

## Cấu trúc feature-first trong admin

### Layer-first (phương án không được chọn)

```
src/
  services/
    roadmap.service.ts
    graph.service.ts
    lesson.service.ts
  hooks/
    useRoadmaps.ts
    useGraphEditor.ts
    useLessonEditor.ts
  components/
    RoadmapModal.tsx
    GraphToolbar.tsx
    LessonEditor.tsx
```

Vấn đề: khi làm việc với tính năng "lesson", bạn phải tìm ở 3 thư mục khác nhau.

### Feature-first (hiện tại)

```
src/features/
  roadmaps/
    services/
      roadmap.service.ts    — CRUD roadmaps + cycleStatus + STATUS_* constants
    hooks/
      useRoadmaps.ts        — list state, modal state, CRUD handlers
    components/
      RoadmapModal.tsx      — modal tạo / sửa roadmap

  graph-editor/
    services/
      graph.service.ts      — loadGraph, saveGraph, normalizeNodeType, makeSnapshot
    hooks/
      useGraphEditor.ts     — load/save state, dirty tracking
      useNodeActions.ts     — canvas handlers (drop, connect, delete...)
      useGraphDraft.ts      — sessionStorage draft side-effect
    components/
      GraphToolbar.tsx      — toolbar trên graph editor
      NodeInventory.tsx     — danh sách nodes chưa đặt lên canvas
      NodeSidePanel.tsx     — panel chi tiết khi chọn node

  lessons/
    services/
      lesson.service.ts     — fetchLesson, updateLessonContent, updateLessonTitle
    hooks/
      useLessonEditor.ts    — fetch + save state, titleSaveStatus
    components/
      LessonEditor.tsx      — BlockNote editor (wraps @vizteck/lesson)
      LessonTitleEditor.tsx — inline title với blur-to-save
```

Mỗi thư mục feature là **hoàn chỉnh**: service → hook → component. Tất cả code liên quan đến "graph editor" nằm trong một chỗ. Muốn xóa tính năng nào chỉ cần xóa thư mục.

**Quy tắc:** Pages (`app/**/page.tsx`) chỉ được chứa layout và delegate logic xuống hooks/services. Components là pure UI, không gọi API trực tiếp.

**Lưu ý đặc biệt:** Trang graph editor (`app/roadmaps/[id]/page.tsx`) **không dùng** `AdminLayout`. Nó tự quản lý toàn màn hình (`height: 100vh`) vì cần canvas chiếm toàn bộ viewport.

---

## Shared packages

Bốn packages được dùng chung giữa các apps:

### packages/db — Prisma client

Export singleton `db` (PrismaClient) và tất cả Prisma-generated types. Mọi thứ truy cập database phải đi qua đây.

```typescript
import { db } from '@vizteck/db';
const roadmaps = await db.roadmap.findMany();
```

### packages/ui — React components cơ bản

Ba components dùng chung:

- `Button` — nút bấm với variants
- `Card` — container card
- `NodeBadge` — badge hiển thị loại node (ROADMAP / LESSON)

Cả `apps/admin` và `apps/web` đều có thể import.

### packages/graph — Shim

**Shim only** — không chứa source code. Chỉ re-export `RoadmapGraph`, `RoadmapNode`, và tất cả graph types từ `@vizteck/core`.

```typescript
import { RoadmapGraph } from '@vizteck/graph'; // thực ra là từ @vizteck/core
```

Không thêm source files vào đây. Mọi logic graph nằm trong `packages/core/src/roadmap/graph/`.

**Lưu ý kỹ thuật:** `RoadmapGraph` duy trì `measuredRef` (Map của node id → dimensions). React Flow reset `measured` mỗi lần re-render qua `adoptUserNodes`. Nếu xóa cache này, nodes sẽ bị `visibility: hidden` sau position update. Không bao giờ bỏ cache này.

### packages/lesson — Shim

**Shim only** — không chứa source code. Chỉ re-export `LessonEditor`, `LessonViewer`, `LessonPageShell`, và tất cả lesson types từ `@vizteck/core`.

```typescript
import { LessonEditor } from '@vizteck/lesson'; // thực ra là từ @vizteck/core
import { LessonViewer } from '@vizteck/lesson';
```

Không thêm source files vào đây. Mọi logic lesson nằm trong `packages/core/src/lesson/`.

Nội dung lưu dưới dạng **BlockNote JSON** (không phải HTML hay markdown). Lợi ích:

- Có thể query và transform mà không cần parse HTML
- Cùng JSON render khác nhau: `LessonViewer` (chỉ đọc) và `LessonEditor` (chỉnh sửa)
- Dark mode tự xử lý qua MutationObserver trên `document.documentElement`

---

## Quy tắc phụ thuộc

```
apps/web         ──import──→  packages/core, packages/ui, packages/graph, packages/lesson
apps/admin       ──import──→  packages/core, packages/ui, packages/graph, packages/lesson
apps/api-gateway ──import──→  packages/db

packages/core   ──import──→  packages/graphql-client, packages/ui, @xyflow/react
packages/graph  ──import──→  packages/core   (shim — chỉ re-export)
packages/lesson ──import──→  packages/core   (shim — chỉ re-export)

apps/*      ←─NO─── packages/*   ✗ packages không được import apps
```

**Ví dụ vi phạm:**

```typescript
// packages/core/src/roadmap/graph/components/RoadmapGraph.tsx
import { fetchRoadmap } from '../../../../apps/web/src/lib/api'; // ✗ SAI
```

```typescript
// packages/ui/src/Button.tsx
import { useAdmin } from '../../apps/admin/src/...'; // ✗ SAI
```

**Ví dụ hợp lệ:**

```typescript
// apps/admin/src/features/roadmaps/graph-editor/components/SomeComponent.tsx
import { RoadmapGraph } from '@vizteck/graph'; // ✓ apps import packages
import { Button } from '@vizteck/ui';          // ✓
```

---

## Data model

Xác minh từ `packages/db/prisma/schema.prisma`:

```
┌──────────────────────────────────────────────┐
│  Roadmap                                     │
│  id          String  (cuid)  PK              │
│  slug        String  UNIQUE                  │
│  title       String                          │
│  description String?                         │
│  coverImage  String?                         │
│  status      DRAFT | PUBLIC | PRIVATE        │
│  createdAt   DateTime                        │
│  updatedAt   DateTime                        │
└──────────────┬───────────────────────────────┘
               │ 1:N
               │ (nodes)
┌──────────────▼───────────────────────────────┐
│  Node                                        │
│  id              String  (cuid)  PK          │
│  roadmapId       String  FK → Roadmap.id     │
│  type            ROADMAP | LESSON            │
│  title           String                      │
│  positionX       Float?   — null = off canvas│
│  positionY       Float?   — null = off canvas│
│  targetRoadmapId String?  FK → Roadmap.id    │
│  content         Json?    — BlockNote JSON   │
│  createdAt       DateTime                    │
│  updatedAt       DateTime                    │
└──────┬───────────────────┬───────────────────┘
       │ source            │ target
       │                   │
┌──────▼───────────────────▼───────────────────┐
│  Edge                                        │
│  id       String  (cuid)  PK                │
│  sourceId String  FK → Node.id              │
│  targetId String  FK → Node.id              │
│  label    String?                           │
└──────────────────────────────────────────────┘
```

### Các điểm quan trọng

**`Roadmap.status`**: Web viewer (`apps/web`) chỉ hiển thị roadmaps có `status = PUBLIC`. `DRAFT` và `PRIVATE` chỉ visible trong admin.

**`Node.positionX/Y`**: `null` nghĩa là node tồn tại trong DB nhưng chưa được đặt lên canvas — gọi là "off-canvas" hay "trong inventory". Kéo node từ NodeInventory lên canvas sẽ set tọa độ.

**`Node.content`**: Chỉ có ý nghĩa với `type = LESSON`. Lưu BlockNote JSON. Đừng set field này cho `ROADMAP` nodes.

**`Node.targetRoadmapId`**: Dùng cho `ROADMAP`-type node — link đến roadmap mà node này đại diện. `targetRoadmapSlug` **không** lưu trong DB — `api-gateway` tính toán on-the-fly từ danh sách roadmaps.

**`Edge.onDelete: Cascade`**: Khi xóa Node, tất cả Edges có `sourceId` hoặc `targetId` trỏ đến Node đó cũng bị xóa tự động.

---

## Xác thực admin

lh222k dùng **single static token** — không có user management, không có database users.

```
apps/admin localStorage('admin_token')
     │
     │  Authorization: Bearer <token>
     ▼
apps/api-gateway AdminGuard
     │
     │  So sánh với process.env.ADMIN_TOKEN
     │  ("supersecret" theo default)
     ▼
  PASS → request tiếp tục
  FAIL → 401 Unauthorized
```

`AdminGuard` (`apps/api-gateway/src/auth/admin.guard.ts`) xử lý cả HTTP và GraphQL context:

```typescript
const req = context.getType() === 'http'
  ? context.switchToHttp().getRequest()
  : GqlExecutionContext.create(context).getContext().req;
```

`apiFetch` trong `apps/admin/src/lib/api.ts` tự động đính kèm token và redirect về `/login` khi nhận 401.

**Trong production:** Đổi `ADMIN_TOKEN` thành giá trị ngẫu nhiên mạnh trong `.env` — không dùng `supersecret`.

---

## Dark mode

Dark mode dùng **Tailwind class strategy** (`darkMode: 'class'`). Khi có class `.dark` trên `<html>`, tất cả CSS variables trong `globals.css` chuyển sang giá trị tối.

**Vấn đề:** Nếu theme được detect sau khi JS bundle load, user sẽ thấy trang sáng nhấp nhánh trước khi tối — gọi là FOUC (Flash of Unstyled Content).

**Giải pháp:** Một script nhỏ chạy **trước mọi thứ** (`strategy="beforeInteractive"`) trong `apps/admin/src/app/layout.tsx`:

```javascript
;(function () {
  try {
    var t = localStorage.getItem("theme")
    if (
      t === "dark" ||
      (t === null && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark")
    }
  } catch (e) {}
})()
```

Script này chạy đồng bộ trong `<head>`, trước khi browser paint lần đầu. Nó kiểm tra:

1. Nếu user đã chọn theme trong `localStorage` → dùng theo lựa chọn đó
2. Nếu chưa chọn → theo system preference (`prefers-color-scheme`)

`ThemeToggle` component sau đó có thể toggle class `.dark` và ghi vào `localStorage('theme')` khi user click.

**Token màu trong Tailwind:** Luôn dùng semantic tokens như `bg-bg-0`, `bg-bg-1`, `text-text-1`, `border-border`, `text-indigo` (được định nghĩa là CSS variables trong `globals.css`). Không bao giờ hardcode màu (`bg-gray-900`). Semantic tokens tự động chuyển đổi theo dark mode.

---

## E2E testing

`apps/e2e` là một Playwright project riêng, **không** chạy cùng `pnpm test` bình thường.

```
apps/e2e/
  tests/
    web.spec.ts    — test apps/web (:3001)
    admin.spec.ts  — test apps/admin (:3002)
    api.spec.ts    — test apps/api-gateway (:3000)
  playwright.config.ts
```

**Yêu cầu:** Tất cả apps phải đang chạy (qua `pnpm dev`) trước khi chạy E2E. Ba service cần thiết: `api-gateway` (:3000), `web` (:3001), `admin` (:3002), và PostgreSQL (:5432).

```bash
# Terminal 1
pnpm dev

# Terminal 2 — chạy sau khi tất cả apps đã start
pnpm --filter @vizteck/e2e test:e2e    # Headless
pnpm --filter @vizteck/e2e test:ui     # Interactive
pnpm --filter @vizteck/e2e test:headed # Có browser
```

E2E tests chạy **tuần tự** (`workers: 1`, `fullyParallel: false`) để tránh race condition giữa tests khi share cùng một database.

---

## Luồng dữ liệu: xem roadmap

Người dùng truy cập `http://localhost:3001/roadmap/javascript-fundamentals`:

```
Browser (apps/web)
  │
  │  1. Next.js render page.tsx cho route /roadmap/[slug]
  │     fetch('http://localhost:3000/api/roadmaps/javascript-fundamentals',
  │           { cache: 'no-store' })
  │
  ▼
apps/api-gateway (:3000)
  │
  │  2. REST controller nhận GET /api/roadmaps/:slug
  │     AdminGuard KHÔNG áp dụng cho public endpoints
  │     db.roadmap.findUnique({ where: { slug }, include: { nodes, edges } })
  │     Kiểm tra status === PUBLIC (chỉ trả về public roadmaps)
  │
  ▼
PostgreSQL (:5432) → trả về Roadmap + Nodes + Edges
  │
  │  3. api-gateway tính targetRoadmapSlug on-the-fly từ danh sách roadmaps
  │     Serialize thành JSON REST response
  │
  ▼
Browser (apps/web)
  │
  │  4. Nhận JSON, render <RoadmapGraph mode="view" />
  │     (từ packages/graph — shim re-export từ @vizteck/core)
  │
  ▼
Người dùng thấy roadmap graph
```

---

## Luồng dữ liệu: lưu nội dung lesson

Admin chỉnh sửa nội dung lesson trong BlockNote editor:

```
Browser (apps/admin)
  │
  │  1. LessonEditor (packages/lesson) gọi onChange callback
  │     useLessonEditor hook debounce 800ms
  │     apiFetch('PATCH /api/nodes/:id/content', { content: blockNoteJSON })
  │     (apiFetch tự đính kèm Authorization: Bearer <token>)
  │
  ▼
apps/api-gateway (:3000)
  │
  │  2. AdminGuard xác thực Bearer token
  │     REST controller nhận PATCH /api/nodes/:id/content
  │     db.node.update({ where: { id }, data: { content } })
  │     Chỉ update field content — không đụng đến nodes/edges khác
  │
  ▼
PostgreSQL (:5432) — cập nhật đúng một row

  ✓ Xong. useLessonEditor cập nhật trạng thái "Saved"
```

**Tại sao không dùng UpsertGraph để lưu lesson?**

`POST /api/roadmaps/:id/graph` (UpsertGraph) thực hiện **DELETE + INSERT** toàn bộ nodes và edges. Nếu bạn lưu lesson content qua endpoint này, bạn phải gửi toàn bộ graph — nếu thiếu bất kỳ node nào, node đó bị xóa khỏi DB. Thay vào đó, dùng endpoint có mục tiêu:

- `PATCH /api/nodes/:id/content` — chỉ update content
- `PATCH /api/nodes/:id/title` — chỉ update title

---

## Tại sao dùng GitFlow?

lh222k dùng **Full GitFlow** thay vì GitHub Flow (chỉ `main` + feature branches).

GitHub Flow phù hợp với team deploy liên tục (mỗi PR merge là một deploy). lh222k cần:

- **Staging environment** để test trước production
- **Release có phiên bản** để phối hợp deploy admin + web cùng lúc
- **Hotfix** không cần đi qua toàn bộ staging cycle

GitFlow cung cấp cấu trúc: `feature/*` → `develop` (staging) → `release/*` → `main` (production).

Nhánh `develop` luôn phản ánh staging. `main` luôn phản ánh production. Không có tính năng nào lên production khi chưa qua staging — điều này quan trọng để admin và public viewer luôn nhất quán.

Xem [Quy trình làm việc hàng ngày](./daily-workflow.md) để biết cách hoạt động cụ thể.
