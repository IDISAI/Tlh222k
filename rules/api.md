# API Rules

> **Trạng thái:** Chưa build. NestJS api-gateway, Prisma, PostgreSQL là hệ thống mục tiêu (target) — xem [docs/onboarding/architecture.md](../docs/onboarding/architecture.md) để biết thiết kế dự kiến.
>
> Hiện tại: apps giao tiếp trực tiếp qua Next.js (no separate backend). File này sẽ được cập nhật khi api-gateway được triển khai.

## Thiết kế dự kiến (planned)

### REST endpoints

- Lesson fields sẽ được patch riêng lẻ: `PATCH /api/nodes/:id/content|title|cover|icon`
- Không dùng `POST /api/roadmaps/:id/graph` (UpsertGraph) để save lesson data — nó xóa toàn bộ nodes và insert lại

### GraphQL

- Apollo Server tại `/graphql`
- Swagger tại `/api-docs`

### Computed fields

- `Node.targetRoadmapSlug` sẽ không lưu trong DB — tính on-the-fly từ danh sách roadmaps trong REST controller
