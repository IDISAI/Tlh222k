# Design Document: Notion Article Node

## Overview

Tính năng này kết nối hai hệ thống hiện có — **Roadmap Canvas** (`BuilderCanvas`, `ViewerCanvas`) và **Notion Workspace** (`NotionWorkspace`) — thành một luồng liền mạch. Mục tiêu cốt lõi:

1. **Double-click** vào `Article_Notion_Node` → `NodeDetailDialog` mở (visual feedback) → tự động điều hướng đến Notion workspace nếu `notionPageId` hợp lệ.
2. **Tạo article notion node** trên canvas → tự động tạo `Document` mới và mở workspace.
3. **Tạo trang top-level trong Notion sidebar** → tự động tạo child article node trên canvas.
4. **Title, publish state đồng bộ hai chiều** giữa `RoadmapNode` và `Document`.
5. **Chapter node "Điều hướng"** → vào `Roadmap_Detail_Page` của chương đó.
6. **Tạo role/skill node** → tự động tạo `Roadmap` mới và liên kết qua `linkedRoadmapId`.

### Nguyên tắc thiết kế

- **Slug là join key bất biến**: `RoadmapNode.slug === Document.slug` là bất biến cốt lõi, không bao giờ thay đổi sau khi tạo.
- **Node first, Document second**: Trong mọi luồng tạo mới, node được tạo trước để nhận slug từ backend, sau đó document mới được tạo với slug đó — tránh orphan document.
- **Compensating transactions**: Nếu bước thứ hai thất bại, bước thứ nhất phải được rollback hoặc để lại trạng thái an toàn (`notionPageId = null`).
- **Best-effort sync**: Title và publish sync là best-effort — lưu node trước, sync document sau; không rollback nếu sync thất bại.
- **packages/core không import apps**: Server Actions được inject từ app layer xuống core components qua props.

---

## UI/UX Flows (ASCII Diagrams)

### Admin Zone — Canvas Builder (`:3002`)

#### Luồng 1: Double-click Article Notion Node → Navigate

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN CANVAS  /roadmaps/[id]                                   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────────┐  │
│  │ role     │  │ skill    │  │                             │  │
│  │ [node]   │→ │ [node]   │→ │  chapter: "Nhập môn HTML"  │  │
│  └──────────┘  └──────────┘  │  [node]                    │  │
│                               └──────────────┬──────────────┘  │
│                                              │                  │
│                          ┌───────────────────┼──────────────┐  │
│                          │                   │              │  │
│                     ┌────▼────┐        ┌─────▼────┐        │  │
│                     │article  │        │ article  │        │  │
│                     │notion   │        │ notion   │        │  │
│                     │[node A] │        │ [node B] │        │  │
│                     └────┬────┘        └──────────┘        │  │
│                          │ double-click                     │  │
└──────────────────────────┼──────────────────────────────────┘  │
                           │                                      │
                           ▼                                      │
         ┌─────────────────────────────────────┐                 │
         │  NodeDetailDialog (sidebar phải)     │                 │
         │  ┌────────────────────────────────┐ │                 │
         │  │ 📄 HTML cơ bản   [article]     │ │                 │
         │  │ ──────────────────────────     │ │                 │
         │  │ Tài liệu: /notion/nthml?page=. │ │                 │
         │  │ Node cha: Nhập môn HTML        │ │                 │
         │  │ Node con: 0                    │ │                 │
         │  └────────────────────────────────┘ │                 │
         │                                     │                 │
         │  [Điều hướng ▶]  [Chỉnh sửa]  [Xóa]│                 │
         └──────────────────────┬──────────────┘                 │
                                │ auto-navigate (100ms delay)    │
                                ▼                                 │
         ┌─────────────────────────────────────┐                 │
         │  NOTION WORKSPACE                   │                 │
         │  /notion/nhap-mon-html              │                 │
         │  ?page=html-co-ban                  │                 │
         │  ┌──────────────┬──────────────────┐│                 │
         │  │ Sidebar      │ Editor           ││                 │
         │  │ Nhập môn HTML│ # HTML cơ bản    ││                 │
         │  │ ▼ HTML cơ bản│                  ││                 │
         │  │   CSS cơ bản │ [block content]  ││                 │
         │  │              │                  ││                 │
         │  └──────────────┴──────────────────┘│                 │
         └─────────────────────────────────────┘                 │
```

#### Luồng 2: Tạo Article Notion Node trên Canvas → Auto-create Document

```
  Admin right-clicks canvas
           │
           ▼
  ┌─────────────────────┐
  │  NodeSelectorModal  │
  │  ─────────────────  │
  │  Title: [__________]│
  │                     │
  │  Loại: [role][skill]│
  │        [chapter]    │
  │        [article ●]  │
  │                     │
  │  ── khi article ──  │
  │  Loại tài liệu:     │
  │  [ Notion ● ] [Jupyter] │
  │                     │
  │  [Hủy]    [Tạo node]│
  └──────────┬──────────┘
             │ submit
             ▼
  ┌──────────────────────────────────────────┐
  │ 1. createNode(article, notion, title)    │
  │    → RoadmapNode { id, slug: "html-cb" } │
  │                                          │
  │ 2. createDocumentForNode(slug, title)    │
  │    → Document { id: "doc_xyz", slug }    │
  │                                          │
  │ 3. updateNode(id, { notionPageId })      │
  │                                          │
  │ 4. navigate → /notion/chapter?page=slug  │
  └──────────────────────────────────────────┘
             │
             ▼
  Notion Workspace mở sẵn trang mới để soạn thảo
```

#### Luồng 3: Chapter Node → Roadmap Detail Page

```
  Double-click chapter "Nhập môn HTML"
           │
           ▼
  NodeDetailDialog
  [Điều hướng] click
           │
           ▼
  /roadmaps/[id]/chapter/nhap-mon-html

  ┌──────────────────────────────────────────────────────────┐
  │  ← Back  |  Nhập môn HTML  |  [Lưu]                     │
  ├────────────────┬─────────────────────────┬───────────────┤
  │  Left Sidebar  │  Canvas (depth=1)        │ Right Sidebar │
  │                │                          │               │
  │  📄 HTML cơ bản│  [Nhập môn HTML]         │  (trống khi   │
  │  📄 CSS cơ bản │    ↙          ↘          │   chưa chọn) │
  │  📄 JS cơ bản  │ [HTML cơ bản] [CSS cơ bản]│               │
  │                │                          │               │
  │  + Thêm node   │  double-click node       │  NodeEditPanel│
  │                │  → auto-navigate to      │  (khi chọn)   │
  │                │    notion workspace      │               │
  └────────────────┴─────────────────────────┴───────────────┘
```

#### Luồng 4: Notion Sidebar → Tạo Sub-page → Tạo Node trên Canvas

```
  Đang ở: /notion/nhap-mon-html?page=html-co-ban

  ┌─────────────────────────────────────────────────────────┐
  │  Sidebar              │  Editor                         │
  │  ─────────────────    │  ─────────────────────────────  │
  │  Nhập môn HTML        │  # HTML cơ bản                  │
  │  ├ HTML cơ bản [●]    │                                 │
  │  │   + Trang mới      │  [block content...]             │
  │  └ CSS cơ bản         │                                 │
  └─────────────────────────────────────────────────────────┘
             │
             │ click "+ Trang mới" dưới "HTML cơ bản"
             │ (parentDoc = html-co-ban → Article_Doc → có node)
             ▼
  ┌──────────────────────────────────────────┐
  │ 1. Lookup: html-co-ban slug              │
  │    → tìm node "HTML cơ bản" trên canvas  │
  │    → parentNodeId = node.id              │
  │                                          │
  │ 2. createNode(article, notion, "Untitled"│
  │    parentId = node "HTML cơ bản" id)     │
  │    → slug: "untitled-2"                  │
  │                                          │
  │ 3. createDocument({ slug, parentDocId }) │
  │                                          │
  │ 4. Canvas cập nhật: node mới dưới        │
  │    "HTML cơ bản"                         │
  └──────────────────────────────────────────┘
             │
             ▼
  Sidebar cập nhật:
  ├ HTML cơ bản [●]
  │   ├ Untitled-2 [mới, đang edit title]
  └ CSS cơ bản

  Canvas cập nhật:
  [Nhập môn HTML] → [HTML cơ bản] → [Untitled-2]
```

---

### Web Zone — Viewer (`:3000`)

#### Luồng 5: Học viên click Article Notion Node trong ViewerCanvas

```
  /roadmap/nhap-mon-html  (apps/web)

  ┌──────────────────────────────────────────────────────────┐
  │  ViewerCanvas (read-only, no edit controls)              │
  │                                                          │
  │  [Nhập môn HTML]                                         │
  │       ↙              ↘                                   │
  │ [HTML cơ bản]    [CSS cơ bản]    [JS cơ bản]            │
  │  ✅ published     🔒 null         ✅ published            │
  │  (clickable)     (disabled,       (clickable)            │
  │                   opacity:50%)                           │
  └──────────────────────────────────────────────────────────┘
             │
             │ click "HTML cơ bản" (notionPageId hợp lệ)
             ▼
  navigate → /notion/nhap-mon-html?page=html-co-ban

  ┌──────────────────────────────────────────────────────────┐
  │  Notion Workspace (canEdit=false)                        │
  │  ┌──────────────────┬───────────────────────────────────┐│
  │  │  Sidebar         │  Editor (READ-ONLY)               ││
  │  │  ──────────────  │  ────────────────────────────     ││
  │  │  Nhập môn HTML   │  # HTML cơ bản                   ││
  │  │  ├ HTML cơ bản●  │                                   ││
  │  │  └ CSS cơ bản    │  Đây là nội dung block...        ││
  │  │                  │                                   ││
  │  │  [KHÔNG có]      │  [KHÔNG có slash command]        ││
  │  │  + Trang mới     │  [KHÔNG có block toolbar]        ││
  │  │  🗑 Thùng rác     │  [KHÔNG có drag handle]          ││
  │  └──────────────────┴───────────────────────────────────┘│
  └──────────────────────────────────────────────────────────┘
```

#### Luồng 6: Article Node chưa được publish (isPublished=false)

```
  /roadmap/nhap-mon-html  (apps/web)

  [JS cơ bản] — isPublished=false

  ViewerCanvas: node ẩn hoặc không thể click
  (tùy theo logic: viewer chỉ load published nodes)

  Nếu học viên truy cập URL trực tiếp:
  /notion/nhap-mon-html?page=js-co-ban

  ┌────────────────────────────────────────┐
  │  Nội dung không khả dụng              │
  │                                        │
  │  📄  Tài liệu này chưa được xuất bản. │
  │      Vui lòng quay lại sau.           │
  │                                        │
  │  [← Quay lại danh sách roadmap]       │
  └────────────────────────────────────────┘
```

---

### Admin Zone — Notion Editor UI

#### Luồng 7: Block Editor với Slash Command

```
  ┌──────────────────────────────────────────────────────────┐
  │  # HTML cơ bản                                           │
  │                                                          │
  │  ⠿ Thẻ <div> là một container block...                  │
  │                                                          │
  │  ⠿ /                                                     │
  │    ┌─────────────────────────────────────────────┐      │
  │    │  🔍 Tìm block...                            │      │
  │    │  ─────────────────────────────────────────  │      │
  │    │  📝 Text          H1 Heading 1              │      │
  │    │  H2 Heading 2     H3 Heading 3              │      │
  │    │  • Bulleted list  1. Numbered list          │      │
  │    │  ☐ To-do          ❝  Quote                 │      │
  │    │  ── Divider       ▶  Toggle                 │      │
  │    │  💡 Callout       ▦  Columns               │      │
  │    │  🖼 Image          📎 File                  │      │
  │    │  🎬 Video         🎵 Audio                  │      │
  │    │  🔗 Embed         </> Code                  │      │
  │    │  @ Mention        🔗 Link to page           │      │
  │    └─────────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────────────┘
```

#### Luồng 8: Title Sync hai chiều

```
  CANVAS                              NOTION EDITOR
  ──────                              ─────────────
  NodeEditPanel                       DocumentView
  [Title: "HTML cơ bản"]              [# HTML cơ bản]
        │                                   │
        │ admin sửa title                   │ admin sửa title
        │ → save                            │ → debounce 500ms
        ▼                                   ▼
  updateNode(id, {title})             syncNodeTitle(slug, title)
        │                                   │
        ▼ (best-effort)                     ▼ (best-effort)
  syncTitleBySlug(slug, title)        updateNode(nodeId, {title})
        │                                   │
        ▼                                   ▼
  Document.title updated              RoadmapNode.title updated

  Nếu sync thất bại:                  Nếu sync thất bại:
  toast.warning "Đã lưu tên node      silent (no error shown)
  nhưng không thể đồng bộ"
```

---

## Architecture

### Tổng quan luồng dữ liệu

```
apps/admin (port 3002)
├── app/notion/actions.ts          ← thêm: createDocumentForNode, syncPublishByNotionPageId
├── app/roadmaps/actions.ts        ← MỚI: createLinkedRoadmap, archiveLinkedDocument
├── app/roadmaps/[id]/page.tsx     ← truyền onNodeTitleSync, onCreateNotionDoc, onCreateRoadmap
└── app/roadmaps/[id]/
    └── chapter/[slug]/page.tsx   ← MỚI: Roadmap_Detail_Page cho chapter

apps/web (port 3000)
└── app/notion/[slug]/page.tsx     ← không thay đổi server logic; ViewerCanvas nhận onNodeClick

packages/core/src/roadmap/
├── types.ts                       ← thêm: linkedRoadmapId, isPublished vào RoadmapNode + UpdateNodeInput
├── builder/
│   ├── components/
│   │   ├── BuilderCanvas.tsx      ← cập nhật: onNodeDoubleClick tự động navigate cho Article_Notion_Node
│   │   ├── NodeDetailDialog.tsx   ← cập nhật: nodeNavigationUrl() cho chapter/role/skill
│   │   ├── NodeSelectorModal.tsx  ← truyền artricleType về caller để trigger post-create hook
│   │   ├── NodeEditPanel.tsx      ← thêm: publish toggle, syncPublish prop
│   │   └── ViewerCanvas.tsx       ← thêm: disabled state cho notionPageId=null nodes
│   └── hooks/
│       └── use-builder-canvas.ts  ← thêm: createNotionNode, createRoleSkillNode

packages/core/src/notion/
└── components/
    └── NotionWorkspace.tsx        ← cải thiện: error handling trong handleCreateChild

packages/core/src/roadmap/utils/
└── slugify.ts                     ← MỚI: re-export slugify cho client-side use

packages/db/prisma/schema.prisma   ← thêm: linkedRoadmapId String? vào Node model

apps/svc-roadmap/src/
├── schema.graphql                 ← thêm: linkedRoadmapId vào UpdateNodeInput + RoadmapNode
└── roadmap/roadmap.service.ts     ← thêm: xử lý linkedRoadmapId trong updateNode
```

### Luồng tạo Article Notion Node (Req 2)

```
NodeSelectorModal.onCreate(nodeType="article", articleType="notion", title)
  │
  ▼
BuilderCanvas.handleCreate()
  ├── 1. canvas.createNode(input)           → RoadmapNode { id, slug, ... }
  │         (nếu thất bại → toast lỗi, dừng)
  ├── 2. onCreateNotionDoc(slug, title, parentDocId?)
  │         → Server Action: createDocumentForNode()
  │         → NotionService.create({ slug, title, parentDocumentId })
  │         → returns Document { id, slug }
  │         (nếu thất bại → toast "Node đã tạo, chưa liên kết", node ở notionPageId=null)
  ├── 3. canvas.updateNodeMeta(nodeId, { notionPageId: doc.id })
  │         (nếu thất bại → log { nodeId, documentId, slug }, toast warning)
  └── 4. window.location.assign(`/notion/${chapterSlug}?page=${articleSlug}`)
              (bỏ qua nếu chapterSlug không xác định được)
```

### Luồng tạo trang Top-Level trong Notion Sidebar (Req 4)

```
NotionWorkspace.handleCreateChild(parentId)
  │
  ├── [Xác định node cha]
  │   ├── parentId === root.id → parentNodeId = chapter node id (roadmapChapterSlug)
  │   ├── parentId là Document có slug khớp với một Article_Notion_Node.slug
  │   │     → parentNodeId = article node id
  │   └── parentId là Document không có node tương ứng (Child_Doc)
  │         → chỉ tạo Document, không tạo node
  │
  ├── [linkToCanvas = parentNodeId !== undefined && canEdit && roadmapBackendEnabled()]
  │   ├── 1. createLinkedArticleNode(chapterSlug, role, parentNodeId) → slug
  │   │         (nếu thất bại → toast lỗi, DỪNG)
  │   ├── 2. actions.create({ parentDocumentId: parentId, slug })
  │   │         (nếu thất bại → xóa node vừa tạo, toast "Đã hủy tạo node")
  │   └── 3. bump() + setSelectedId(doc.id)
  │
  └── [linkToCanvas = false]
      └── actions.create({ parentDocumentId: parentId }) → doc (hành vi cũ)
```

### Luồng Title Sync hai chiều (Req 3)

```
Canvas → Notion:
  NodeEditPanel.handleSave()
    → onSave(id, { title })
    → useBuilderCanvas.updateNodeMeta()
      → service.updateNode(id, { title })   ← lưu node trước
      → onTitleSync(slug, title)             ← best-effort, không await kết quả
          → Server Action: syncTitleBySlug(slug, title)
          → NotionService.update({ id: doc.id, title })

Notion → Canvas:
  DocumentView.onTitleChange (debounce 500ms)
    → NotionWorkspace.syncNodeTitle(slug, title)
      → RoadmapService.updateNode(node.id, { title }, role)  ← best-effort
```

---

## Components and Interfaces

### 1. `BuilderCanvas.tsx` — Double-click với auto-navigate (Req 1, 2)

`onNodeDoubleClick` cập nhật để xử lý `Article_Notion_Node` với auto-navigate:

```typescript
// onNodeDoubleClick — cập nhật để auto-navigate cho Article_Notion_Node
const onNodeDoubleClick = useCallback(
  (_event: React.MouseEvent, rfNode: Node) => {
    const domain = canvas.nodesRef.current.find((n) => n.id === rfNode.id)
    if (!domain || domain.isDeleted) return

    // Article Notion Node: mở NodeDetailDialog VÀ auto-navigate nếu notionPageId hợp lệ
    if (domain.nodeType === "article" && domain.articleType === "notion") {
      setDetailNode(domain)  // show sidebar (visual feedback)
      if (domain.notionPageId) {
        const parent = canvas.nodesRef.current.find((n) => n.id === domain.parentId)
        const chapterSlug = parent?.nodeType === "chapter" ? parent.slug : undefined
        if (chapterSlug) {
          // Ngắn delay nhỏ để sidebar render trước khi navigate
          setTimeout(() => {
            window.location.assign(
              `/notion/${chapterSlug}?page=${encodeURIComponent(domain.slug)}`
            )
          }, 100)
        }
      }
      return
    }

    // Tất cả node khác: hành vi hiện tại
    setDetailNode(domain)
  },
  [canvas]
)
```

Không cần `pointerDownPos` ref, không cần `clickTimerRef`, không cần drag threshold — tất cả đã được ReactFlow xử lý. `onNodeDoubleClick` là event duy nhất, không có `onNodeClick` custom. `BuilderCanvasProps` **không** cần thêm `roadmapSlug` chỉ để build URL trong `onNodeDoubleClick` — URL được build từ `canvas.nodesRef.current` (parent chapter slug).

### 2. `NodeDetailDialog.tsx` — Cập nhật `nodeNavigationUrl()` (Req 10, 11)

`nodeNavigationUrl()` nhận thêm `roadmapSlug` để build URL chapter/role/skill:

```typescript
export function nodeNavigationUrl(
  node: RoadmapNode,
  notebookBasePath = "/learn",
  notionBasePath = "/notion",
  parentChapterSlug?: string,
  roadmapSlug?: string,         // MỚI: để build /builder/{roadmapSlug}/chapter/{chapterSlug}
): string | null {
  if (node.nodeType === "chapter") {
    if (!roadmapSlug || !node.slug) return null
    return `/builder/${roadmapSlug}/chapter/${node.slug}`  // Req 10.1
  }
  if (node.nodeType === "role" || node.nodeType === "skill") {
    if (node.linkedRoadmapId) {
      // Điều hướng vào roadmap detail của role/skill (Req 11.5)
      return `/roadmap/${node.slug}`
    }
    return null  // linkedRoadmapId=null → toast warning ở handleNavigate
  }
  if (node.nodeType === "article") {
    // ... logic hiện có cho notion / jupyter / external
  }
  return null
}
```

`handleNavigate()` cập nhật toast message cho từng trường hợp null:
- Chapter không có `roadmapSlug` → "Không thể điều hướng đến chapter này"
- Role/Skill `linkedRoadmapId = null` → "Node này chưa được liên kết với roadmap nào."

### 3. `NodeSelectorModal.tsx` — Trả về `articleType` cho caller

`onCreate` callback được mở rộng để trả về `articleType`:

```typescript
// NodeSelectorModalProps.onCreate signature thay đổi:
onCreate: (input: {
  nodeType: NodeType
  articleType?: ArticleType     // MỚI: chỉ set khi nodeType="article"
  title: string
  parentId: string | null
  x: number
  y: number
}) => Promise<boolean>
```

Trong form, khi `nodeType === "article"`, hiển thị thêm bước chọn `articleType` ("notion" / "jupyter"). Khi submit, truyền `articleType` về caller trong `onCreate` input.

### 4. `NodeEditPanel.tsx` — Publish toggle + sync (Req 7)

Thêm `isPublished` field và `onPublishSync` prop:

```typescript
interface NodeEditPanelProps {
  node: RoadmapNode
  onClose: () => void
  onSave: (id: string, input: UpdateNodeInput) => Promise<boolean>
  // MỚI: sync publish state với Document (chỉ cho article notion nodes)
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
}
```

Thêm toggle publish trong panel (chỉ render khi `node.nodeType === "article"` và `node.articleType === "notion"`):

```tsx
{isNotionArticle && (
  <div className="flex items-center justify-between border-t pt-4">
    <Label htmlFor="edit-published">Xuất bản</Label>
    <Switch
      id="edit-published"
      checked={isPublished}
      onCheckedChange={setIsPublished}
    />
  </div>
)}
```

Trong `handleSave`: sau khi `onSave` thành công, nếu `isPublished` thay đổi và `node.notionPageId` non-null → gọi `onSyncPublish(node.notionPageId, isPublished)`. Nếu sync thất bại → toast warning, không rollback.

### 5. `ViewerCanvas.tsx` — Click navigation + disabled state (Req 6)

```typescript
interface ViewerCanvasProps {
  nodes: RoadmapNode[]
  onNodeClick?: (node: RoadmapNode) => void
  className?: string
}
```

`onNodeClick` được truyền từ web page, thực hiện navigate:

```typescript
// apps/web/app/roadmap/[slug]/page.tsx (hoặc component chứa ViewerCanvas)
const handleNodeClick = (node: RoadmapNode) => {
  if (node.nodeType !== "article" || node.articleType !== "notion") return
  if (!node.notionPageId) return  // disabled — pointer-events:none trên node
  const parent = nodes.find((n) => n.id === node.parentId)
  const chapterSlug = parent?.nodeType === "chapter" ? parent.slug : undefined
  if (!chapterSlug) return
  window.location.assign(`/notion/${chapterSlug}?page=${encodeURIComponent(node.slug)}`)
}
```

`BuilderNodeComponent` nhận `isDisabled` từ `BuilderCanvasContext` (hoặc từ node data) để render disabled state khi `notionPageId = null` và mode là viewer:

```typescript
// Trong BuilderFlowNode data:
type BuilderFlowNodeData = {
  node: RoadmapNode
  viewerMode?: boolean  // MỚI: true trong ViewerCanvas
}

// CSS cho disabled state trong viewer:
// className={cn(node.viewerMode && !node.notionPageId && node.articleType === "notion"
//   ? "pointer-events-none opacity-50" : "")}
```

### 6. `NotionWorkspace.tsx` — Cải thiện error handling + sub-page node linking (Req 4)

Logic trong `handleCreateChild` được cập nhật để hỗ trợ resolve `parentNodeId` theo cả hai trường hợp (Root_Doc và Article_Doc):

```typescript
const handleCreateChild = useCallback(async (parentId: string) => {
  if (!actions.create) return

  // Bước 1: Xác định parentNodeId
  let parentNodeId: string | undefined
  if (canEdit && !!roadmapChapterSlug && !!roadmapRole && roadmapBackendEnabled()) {
    if (parentId === root.id) {
      // Trang con của Root_Doc → cha là chapter node
      const svc = new RoadmapService()
      const graph = await svc.graphBySlug(roadmapChapterSlug, { authenticated: true })
      const chapter = graph?.nodes.find((n) => n.slug === roadmapChapterSlug)
      parentNodeId = chapter?.id
    } else {
      // Trang con của Article_Doc → tìm node có slug khớp với Document của parentId
      // actions.getById trả về Document; dùng slug của Document để lookup node
      const parentDoc = await actions.getById(parentId)
      if (parentDoc?.slug) {
        const svc = new RoadmapService()
        const graph = await svc.graphBySlug(roadmapChapterSlug, { authenticated: true })
        const matchedNode = graph?.nodes.find((n) => n.slug === parentDoc.slug)
        parentNodeId = matchedNode?.id
      }
    }
  }

  const linkToCanvas = parentNodeId !== undefined && canEdit && roadmapBackendEnabled()

  if (linkToCanvas) {
    // 1. Tạo node trước
    let slug: string | undefined
    try {
      slug = await createLinkedArticleNode(roadmapChapterSlug!, roadmapRole!, parentNodeId)
    } catch {
      toast.error("Không thể tạo node trên canvas.")
      return  // Dừng — không tạo Document
    }

    // 2. Tạo Document với slug từ node
    let doc: NotionDoc
    try {
      doc = await actions.create({ parentDocumentId: parentId, slug })
    } catch {
      // Compensating transaction: xóa node vừa tạo
      if (slug) await deleteLinkedArticleNode(roadmapChapterSlug!, slug, roadmapRole!).catch(() => {})
      toast.error("Không thể tạo trang Notion. Đã hủy tạo node.")
      return
    }
    bump()
    setSelectedId(doc.id)
    return
  }

  // Sub-page không có node tương ứng hoặc không link canvas: hành vi cũ
  const doc = await actions.create({ parentDocumentId: parentId })
  bump()
  setSelectedId(doc.id)
}, [actions, bump, canEdit, roadmapChapterSlug, roadmapRole, root.id])
```

`createLinkedArticleNode` nhận thêm param `overrideParentNodeId` để set `parentId` đúng khi tạo node con của Article_Doc:

```typescript
async function createLinkedArticleNode(
  chapterSlug: string,
  role: RoadmapRole,
  overrideParentNodeId?: string  // MỚI: override parentId trên canvas
): Promise<string | undefined> {
  const svc = new RoadmapService()
  const graph = await svc.graphBySlug(chapterSlug, { authenticated: true })
  if (!graph) return undefined
  const chapter = graph.nodes.find((n) => n.slug === chapterSlug)
  if (!chapter) return undefined

  // Dùng overrideParentNodeId nếu có (Article_Doc cha), fallback về chapter
  const actualParentId = overrideParentNodeId ?? chapter.id
  const siblings = graph.nodes.filter((n) => n.parentId === actualParentId)

  const node = await svc.createNode(
    {
      roadmapId: chapter.roadmapId,
      parentId: actualParentId,
      title: "Untitled",
      nodeType: "article",
      articleType: "notion",
      positionX: chapter.positionX + siblings.length * 220,
      positionY: chapter.positionY + 160,
      order: siblings.length,
    },
    role
  )
  return node.slug
}
```

Thêm helper `deleteLinkedArticleNode` để compensating transaction (delete node bằng slug):

```typescript
async function deleteLinkedArticleNode(
  chapterSlug: string,
  nodeSlug: string,
  role: RoadmapRole
): Promise<void> {
  const svc = new RoadmapService()
  const graph = await svc.graphBySlug(chapterSlug, { authenticated: true })
  const node = graph?.nodes.find((n) => n.slug === nodeSlug)
  if (node) await svc.deleteNode(node.id, role)
}
```

### 7. `use-builder-canvas.ts` — Mở rộng createNode (Req 2, 11)

Hook nhận thêm callback props từ `BuilderCanvas` để trigger post-create side effects:

```typescript
export function useBuilderCanvas(
  roadmapId: string,
  role: CallerRole,
  onTitleSync?: (slug: string, title: string) => void | Promise<void>,
  // MỚI: post-create hooks
  onCreateNotionDoc?: (slug: string, title: string, parentDocId?: string) => Promise<{ id: string } | null>,
  onCreateRoadmap?: (title: string, slug: string) => Promise<{ id: string } | null>,
)
```

`createNode` được tách thành 3 paths:

```typescript
const createNode = useCallback(async (
  input: Omit<CreateNodeInput, "roadmapId"> & { articleType?: ArticleType }
): Promise<RoadmapNode | null> => {
  // 1. Tạo node trước (luôn luôn)
  const node = await service.createNode({ ...input, roadmapId }, role)
  // ... push to state, toast success

  // 2. Post-create: Article Notion
  if (input.nodeType === "article" && input.articleType === "notion" && onCreateNotionDoc) {
    const parentChapter = nodes.find(n => n.id === input.parentId && n.nodeType === "chapter")
    const doc = await onCreateNotionDoc(node.slug, node.title, undefined).catch(() => null)
    if (doc) {
      await service.updateNode(node.id, { notionPageId: doc.id }, role).catch((err) => {
        console.error("[notion-article-node] notionPageId update failed", { nodeId: node.id, documentId: doc.id, slug: node.slug, err })
        toast.warning("Node đã tạo nhưng không thể lưu liên kết Notion.")
      })
      applyNodePatch(node.id, { notionPageId: doc.id })
      if (parentChapter) {
        window.location.assign(`/notion/${parentChapter.slug}?page=${encodeURIComponent(node.slug)}`)
      }
    } else {
      toast.warning("Không thể tạo trang Notion. Node đã được tạo nhưng chưa được liên kết.")
    }
  }

  // 3. Post-create: Role/Skill
  if ((input.nodeType === "role" || input.nodeType === "skill") && onCreateRoadmap) {
    const roadmapSlug = slugify(node.title)
    const roadmap = await onCreateRoadmap(node.title, roadmapSlug).catch(() => null)
    if (roadmap) {
      await service.updateNode(node.id, { linkedRoadmapId: roadmap.id }, role).catch(() => {})
      applyNodePatch(node.id, { linkedRoadmapId: roadmap.id })
    } else {
      toast.error("Không thể tạo roadmap. Node đã được tạo nhưng chưa được liên kết với roadmap.")
    }
  }

  return node
}, [/* deps */])
```

---

## Data Models

### Database Schema Changes

**`packages/db/prisma/schema.prisma`** — thêm field vào `Node` model:

```prisma
model Node {
  // ... existing fields ...
  linkedRoadmapId String?   // MỚI: ID của Roadmap liên kết (cho role/skill nodes — Req 11)
  isPublished     Boolean   @default(false)  // MỚI: sync với Document.isPublished (Req 7)

  linkedRoadmap Roadmap? @relation("NodeLinkedRoadmap", fields: [linkedRoadmapId], references: [id], onDelete: SetNull)
}

model Roadmap {
  // ... existing fields ...
  linkedNodes Node[] @relation("NodeLinkedRoadmap")  // back-relation
}
```

Migration: `prisma migrate dev --name add-linked-roadmap-id-and-is-published`

### Type System Updates

**`packages/core/src/roadmap/types.ts`**:

```typescript
export interface RoadmapNode {
  // ... existing fields ...
  linkedRoadmapId?: string | null  // MỚI: Req 11
  isPublished?: boolean            // MỚI: Req 7
}

export type UpdateNodeInput = Partial<
  Omit<CreateNodeInput, "roadmapId" | "nodeType" | "slug">
> & {
  linkedRoadmapId?: string | null  // MỚI
  isPublished?: boolean            // MỚI
}
```

### GraphQL Schema Updates

**`apps/svc-roadmap/src/schema.graphql`**:

```graphql
type RoadmapNode {
  # ... existing fields ...
  linkedRoadmapId: ID          # MỚI
  isPublished: Boolean!        # MỚI (default false)
}

input UpdateNodeInput {
  # ... existing fields ...
  linkedRoadmapId: ID          # MỚI
  isPublished: Boolean         # MỚI
}
```

---

## New Server Actions

### `apps/admin/app/notion/actions.ts` — thêm 2 actions

```typescript
/**
 * Tạo Document mới cho article node với slug khớp.
 * Tìm parent doc bằng chapterSlug (nếu có) để set parentDocumentId.
 * Req 2.1–2.2
 */
export async function createDocumentForNode(
  slug: string,
  title: string,
  parentDocumentId?: string
): Promise<{ id: string; slug: string } | null> {
  const { userId } = await auth()
  const role = await getRole()
  try {
    const doc = await service.create(role, userId ?? "unknown", {
      slug,
      title,
      parentDocumentId: parentDocumentId ?? null,
    })
    return { id: doc.id, slug: doc.slug! }
  } catch {
    return null
  }
}

/**
 * Sync trạng thái isPublished từ RoadmapNode sang Document liên kết.
 * notionPageId = Document.id (Req 7).
 */
export async function syncPublishByNotionPageId(
  notionPageId: string,
  isPublished: boolean
): Promise<void> {
  const role = await getRole()
  await service.update(role, { id: notionPageId, isPublished })
}
```

### `apps/admin/app/roadmaps/actions.ts` — file mới

```typescript
"use server"

import { RoadmapService } from "@workspace/core/roadmap/roadmap.service"
import { NotionService } from "@workspace/core/notion/notion.service"
import { getRole } from "@/lib/auth"

const roadmapService = new RoadmapService()
const notionService = new NotionService()

/**
 * Tạo Roadmap mới khi tạo role/skill node (Req 11.1).
 * isPublished = false mặc định.
 */
export async function createLinkedRoadmap(
  title: string,
  slug: string
): Promise<{ id: string } | null> {
  const role = await getRole()
  try {
    const roadmap = await roadmapService.createRoadmap({ title, slug }, role)
    return { id: roadmap.id }
  } catch {
    return null
  }
}

/**
 * Archive Document khi xóa vĩnh viễn Article_Notion_Node (Req 8.2).
 * notionPageId = Document.id.
 */
export async function archiveLinkedDocument(notionPageId: string): Promise<void> {
  const role = await getRole()
  await notionService.archive(role, notionPageId)
}
```

---

## New Pages and Routes

### `apps/admin/app/roadmaps/[id]/chapter/[slug]/page.tsx` — Roadmap Detail Page (Req 10)

```typescript
export default async function ChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id, slug } = await params
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  // Load graph để tìm chapter node theo slug
  // Client component ChapterDetailPageClient nhận roadmapId + chapterSlug
  return (
    <ChapterDetailPageClient
      roadmapId={id}
      chapterSlug={slug}
      role={role}
      onNodeTitleSync={syncTitleBySlug}
      onCreateNotionDoc={createDocumentForNode}
    />
  )
}
```

**Layout của `ChapterDetailPageClient`**:

```
┌───────────────────────────────────────────────────────────────┐
│ Toolbar: ← Back | "Nhập môn HTML" / chapter slug | Lưu        │
├─────────────────┬─────────────────────────┬───────────────────┤
│ Left Sidebar    │ Canvas (ReactFlow)       │ Right Sidebar     │
│ Danh sách       │ Chapter node (cha) +     │ NodeEditPanel     │
│ node con        │ direct children only     │ (node được chọn)  │
│ (parentId=      │ depth=1, từ chapter cha  │ hoặc placeholder  │
│  chapterId)     │ xuống các node con        │ "Chọn node"       │
└─────────────────┴─────────────────────────┴───────────────────┘
```

Canvas render bằng `BuilderCanvas` với `nodes` được filter: `[chapterNode, ...directChildren]`. Double-click vào article notion node → mở `NodeDetailDialog` và tự động navigate (Req 1, Req 10.4, Req 10.5).

**Fallback**: nếu `chapterSlug` không tồn tại → hiển thị error với link `← Quay về Builder` (`/roadmaps/${id}`).

---

## Slug Utilities

### `packages/core/src/roadmap/utils/slugify.ts` — MỚI

Re-export `slugify` từ `hierarchy.ts` pattern để dùng trên client:

```typescript
/**
 * Client-safe slug generator — mirrors svc-roadmap/hierarchy.ts slugify().
 * Vietnamese diacritics stripped via NFD decomposition.
 * Max 80 chars (svc-roadmap convention). Falls back to "untitled" for empty.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return base || "untitled"
}
```

Export từ `packages/core/src/roadmap/utils/index.ts` và barrel `packages/core/src/roadmap/index.ts`.

---

## Block Types (Req 12)

`NotionWorkspace` sử dụng **BlockNote** (đã được cài đặt trong codebase) làm block editor engine. BlockNote hỗ trợ hầu hết các block types yêu cầu out-of-the-box; các block nâng cao cần custom extension.

### Block types map

| Requirement | BlockNote block type | Ghi chú |
|---|---|---|
| paragraph | `paragraph` | Mặc định |
| heading_1/2/3 | `heading` (level 1/2/3) | Built-in |
| bulleted_list | `bulletListItem` | Built-in |
| numbered_list | `numberedListItem` | Built-in |
| todo/checkbox | `checkListItem` | Built-in |
| quote | `quote` (hoặc custom) | Custom extension nếu chưa có |
| divider | `horizontalRule` | Custom extension |
| toggle | `toggle` | Custom extension |
| callout | `callout` | Custom extension |
| columns | `columnList` + `column` | Custom extension |
| image | `image` | Built-in (upload + URL) |
| video | `video` | Custom extension |
| audio | `audio` | Custom extension |
| file | `file` | Custom extension |
| embed | `embed` | Custom extension |
| code | `codeBlock` | Built-in hoặc custom |
| mention | inline content `mention` | Custom inline |
| link_to_page | `linkToPage` | Custom block |

### Slash command

BlockNote built-in slash menu (`/`) tự động expose tất cả block types đã đăng ký. Custom blocks sẽ được thêm vào slash menu qua `insertInlineContent` hoặc `insertBlocks` API.

### Drag & drop reorder

BlockNote built-in drag handle (gutter icon `⠿`) cho mỗi block — không cần implement thêm.

### Block transform

BlockNote built-in: click vào gutter icon → context menu → "Turn into" cho phép transform giữa các loại text blocks.

### Indent/Outdent

Tab / Shift+Tab built-in cho list blocks trong BlockNote.

### Implementation note

Custom blocks (toggle, callout, columns, video, audio, file, embed, link_to_page) được define trong `packages/core/src/notion/components/blocks/` và đăng ký vào BlockNote editor schema. Mỗi custom block cần:
- `BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, customBlock } })`
- React render component
- Slash menu item

---

## Error Handling

### Ma trận lỗi và hành vi

| Scenario | Step thất bại | Hành vi | User-facing |
|---|---|---|---|
| Tạo article notion node | Node creation fails | Dừng, không tạo doc | toast.error |
| Tạo article notion node | Doc creation fails | Node ở `notionPageId=null` | toast.warning "Node đã tạo, chưa liên kết" |
| Tạo article notion node | `notionPageId` update fails | Log `{nodeId, documentId, slug}` | toast.warning |
| Notion sidebar top-level page | Node creation fails | Dừng, không tạo doc | toast.error |
| Notion sidebar top-level page | Doc creation fails | DELETE node (compensating) | toast.error "Đã hủy tạo node" |
| Title sync Canvas → Notion | `syncTitleBySlug` fails | Node title saved; doc title NOT synced | toast.warning |
| Title sync Notion → Canvas | `syncNodeTitle` fails | Doc title saved; node title NOT synced | silent (best-effort) |
| Publish sync | `syncPublishByNotionPageId` fails | Node publish saved; doc NOT synced | toast.warning |
| Delete node (canvas) | — | Chỉ xóa khỏi canvas; doc intact | — |
| Delete node (permanent) | Node delete fails | Dừng, doc intact | toast.error |
| Delete node (permanent) | Doc archive fails | Node deleted; doc NOT archived | log + toast.warning |
| Tạo role/skill node | Roadmap creation fails | Node ở `linkedRoadmapId=null` | toast.error |
| Tạo role/skill node | `linkedRoadmapId` update fails | Node exists, log orphan pair | silent log |

### Compensating Transaction Pattern

```typescript
// Pattern chuẩn cho "create A then B, rollback A nếu B fail":
async function createNodeThenDoc(nodeInput, docInput) {
  const node = await createNode(nodeInput)  // step 1 — master
  if (!node) return { success: false, reason: "node_failed" }

  const doc = await createDoc(docInput)     // step 2 — dependent
  if (!doc) {
    await deleteNode(node.id).catch((err) =>  // compensating
      console.error("[compensating-tx] node delete failed", { nodeId: node.id, err })
    )
    return { success: false, reason: "doc_failed" }
  }

  return { success: true, node, doc }
}
```

---

## Correctness Properties

*Một property là đặc tính hoặc hành vi phải đúng trong mọi lần thực thi hợp lệ của hệ thống — về cơ bản là phát biểu hình thức về những gì hệ thống phải làm. Properties là cầu nối giữa specification dạng ngôn ngữ tự nhiên và đảm bảo correctness có thể kiểm tra tự động.*

### Property 1: Slug join-key round-trip

*Với bất kỳ* title hợp lệ nào, sau khi luồng tạo `Article_Notion_Node` hoàn tất thành công, `RoadmapNode.slug` phải bằng `Document.slug` của `Article_Doc` liên kết, và giá trị này phải không thay đổi khi đọc lại từ database.

**Validates: Requirements 2.1, 2.2, 9.3**

### Property 2: Slug format invariant

*Với bất kỳ* chuỗi đầu vào nào (bao gồm tiếng Việt, ký tự đặc biệt, chuỗi rỗng), `slugify(input)` phải trả về chuỗi chỉ chứa `[a-z0-9-]`, có độ dài từ 1 đến 80 ký tự, không bắt đầu hoặc kết thúc bằng `-`, và không có hai dấu `-` liên tiếp.

**Validates: Requirements 9.1**

### Property 3: Slug uniqueness

*Với bất kỳ* hai node có cùng title trong cùng roadmap, `uniqueNodeSlug()` phải trả về hai slug khác nhau. Không có hai `RoadmapNode.slug` nào có thể bằng nhau trong cùng một hệ thống.

**Validates: Requirements 9.2**

### Property 4: Slug immutability

*Với bất kỳ* `RoadmapNode` nào, sau khi `updateNode({ title: newTitle })` thành công, `node.slug` phải bằng slug ban đầu tại thời điểm tạo — slug không bao giờ thay đổi khi title thay đổi.

**Validates: Requirements 9.5**

### Property 5: Title sync round-trip

*Với bất kỳ* chuỗi title hợp lệ nào, sau khi `syncTitleBySlug(slug, title)` hoàn tất thành công, `Document` có `slug` đó phải có `title` bằng giá trị đã sync. Ngược lại, sau khi `syncNodeTitle(slug, title)` hoàn tất, `RoadmapNode` có `slug` đó phải có `title` bằng giá trị đã sync.

**Validates: Requirements 3.1, 3.2**

### Property 6: Publish sync invariant

*Với bất kỳ* `Article_Notion_Node` nào có `notionPageId` non-null, sau khi `syncPublishByNotionPageId(notionPageId, isPublished)` hoàn tất thành công, `Document.isPublished` phải bằng giá trị `isPublished` được truyền vào.

**Validates: Requirements 7.1, 7.2**

### Property 7: Compensating transaction — no orphan document

*Với bất kỳ* luồng tạo top-level page nào trong Notion sidebar, nếu bước tạo `Document` thất bại sau khi `Article_Notion_Node` đã được tạo thành công, thì node đó phải được xóa — không tồn tại `RoadmapNode` nào với `slug` đó trong hệ thống sau khi luồng kết thúc.

**Validates: Requirements 4.4, 4.5**

### Property 8: Slug URL round-trip

*Với bất kỳ* `Document` nào có `slug` không null, `getBySlug(slug)` phải trả về `Document` có `id` mà `getById(id)` trả về đúng `Document` đó — parse(slug) → id → getById(id) = same document.

**Validates: Requirements 5.2, 9.4**

### Property 9: nodeNavigationUrl — chapter URL format

*Với bất kỳ* `Chapter_Node` nào có `slug` non-empty và `roadmapSlug` non-empty, `nodeNavigationUrl(node, ..., roadmapSlug)` phải trả về chuỗi khớp pattern `/builder/{roadmapSlug}/chapter/{chapterSlug}`.

**Validates: Requirements 10.1**

### Property 10: linkedRoadmapId invariant

*Với bất kỳ* role/skill node nào sau khi luồng auto-create roadmap hoàn tất thành công, `RoadmapNode.linkedRoadmapId` phải bằng `Roadmap.id` của roadmap được tạo, và `Roadmap` đó phải truy vấn được trong hệ thống.

**Validates: Requirements 11.1, 11.2**

### Property 11: Sub-page node linking invariant

*Với bất kỳ* Document nào có trang cha là `Article_Doc` (có node tương ứng trên canvas), sau khi luồng tạo sub-page hoàn tất thành công, phải tồn tại một `RoadmapNode` mới với `parentId` bằng `id` của node tương ứng với `Article_Doc` đó — join key `node.slug === document.slug` phải đúng.

**Validates: Requirements 4.1, 4.2, 4.3**

---

## Testing Strategy

### Dual Testing Approach

**Unit tests** — Vitest (package `@workspace/core`):
- `slugify()`: specific examples với tiếng Việt, emoji, chuỗi rỗng, ký tự đặc biệt
- `nodeNavigationUrl()`: từng `nodeType`, các trường hợp null
- `handleCreate` flow: mock `onCreateNotionDoc`, verify call order
- Compensating transaction: mock doc creation failure, verify node deletion called
- `NodeEditPanel` publish toggle: verify `onSyncPublish` called với đúng args

**Property-based tests** — [fast-check](https://fast-check.io/) (TypeScript):

```typescript
// Ví dụ property test cho Slug format invariant (Property 2)
import fc from "fast-check"
import { slugify } from "@workspace/core/roadmap/utils/slugify"

test("Property 2: slugify output is always valid", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const slug = slugify(input)
      expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
      expect(slug.length).toBeGreaterThanOrEqual(1)
      expect(slug.length).toBeLessThanOrEqual(80)
      expect(slug).not.toMatch(/--/)
    }),
    { numRuns: 1000 }  // minimum 100, khuyến nghị 1000 cho pure functions
  )
})
// Tag: Feature: notion-article-node, Property 2: slugify output is always valid
```

**Cấu hình property tests**:
- Library: `fast-check` — TypeScript-native, không cần config phức tạp
- Minimum 100 iterations per test (`numRuns: 100`)
- Pure functions (slugify, nodeNavigationUrl) → 1000 runs
- Stateful tests (slug round-trip, title sync) → 100 runs với mocks
- Tag format: `// Tag: Feature: notion-article-node, Property N: {property_text}`

**Integration tests** — manual / Playwright E2E:
- Luồng tạo article notion node end-to-end (builder → notion workspace)
- Luồng tạo trang top-level trong Notion sidebar → canvas update
- Chapter "Điều hướng" → Roadmap_Detail_Page load đúng nodes
- Viewer zone: click article node → navigate, disabled state cho null notionPageId

**Tests không dùng PBT** (UI rendering, side effects):
- `ViewerCanvas` disabled state rendering → snapshot test
- `NodeSelectorModal` articleType selection step → example test
- Toast messages → example test với mock
- Server Actions error paths → example test với mock Prisma

### Test Coverage Map

| Requirement | Test type | Property |
|---|---|---|
| Req 1: Double-click navigation | Unit (example) + Integration | — |
| Req 2: Auto-create Document | Unit (example + PBT) | Property 1, 7 |
| Req 3: Title sync | Unit (PBT) | Property 5 |
| Req 4: Notion sidebar → node | Unit (example + PBT) | Property 7 |
| Req 5: initialSelectedId | Unit (example) | Property 8 |
| Req 6: Viewer read-only | Snapshot + Integration | — |
| Req 7: Publish sync | Unit (PBT) | Property 6 |
| Req 8: Delete keeps doc | Unit (example) | — |
| Req 9: Slug | Unit (PBT) | Property 2, 3, 4, 8 |
| Req 10: Chapter navigation | Unit (PBT) | Property 9 |
| Req 11: Role/Skill → Roadmap | Unit (example + PBT) | Property 10 |
