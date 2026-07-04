# API Rules (NestJS)

## REST endpoints

- Lesson fields are patched individually: `PATCH /api/nodes/:id/content|title|cover|icon`
- Never use `POST /api/roadmaps/:id/graph` (UpsertGraph) to save lesson data — it deletes all nodes and re-inserts

## GraphQL

- Apollo Server at `/graphql` — playground enabled
- Swagger at `/api-docs`

## Computed fields

- `Node.targetRoadmapSlug` is NOT stored in DB — computed on the fly from full roadmap list in the REST controller
