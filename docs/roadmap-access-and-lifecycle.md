# Roadmap access and lifecycle

Approved product contract for public Field/Roadmap flow and CMS. Tracked as
GitHub issues `IDISAI/Tlh222k#54`-`#69`, indexed in
[roadmap-implementation-tickets.md](roadmap-implementation-tickets.md).

## Source priority

1. Direct product-owner decisions from the 2026-07-29 requirements session.
2. Claude Design for layout, dimensions, spacing, and colors.
3. Public-flow build prompt for navigation and interaction behavior.

Production screens must use working backend behavior. Do not ship fake data or
controls without behavior.

## Roles

| Actor | Public access | Persistence | CMS |
| --- | --- | --- | --- |
| Guest | Published FREE; PRIVATE through direct link | None | No |
| Viewer | Same as Guest | Progress and roadmap favorite | 403 |
| AIO learner | Viewer access plus INTERNAL | Progress and roadmap favorite | 403 |
| Admin | All content | Full | Full Field/Roadmap/content CRUD |
| Super-admin | All content | Full | Admin access plus user/role management |

Clerk is the sole authentication engine. Sign-in/sign-up UI may be custom.
After authentication, return to the originating route, selected node/notebook
cell, and canvas location.

## Roadmap state

Three independent axes:

| Axis | Values | Meaning |
| --- | --- | --- |
| Lifecycle | `DRAFT`, `PUBLISHED` | Whether non-CMS readers can open it |
| Discoverability | `PUBLIC`, `PRIVATE` | Listed/searchable vs direct-link only |
| Entitlement | `FREE`, `INTERNAL` | General access vs AIO/Admin access |

Examples:

- `PUBLISHED + PRIVATE + FREE`: unlisted; direct link works for everyone.
- `PUBLISHED + PUBLIC + INTERNAL`: listed only for entitled users.
- `DRAFT`: unavailable outside CMS regardless of other fields.

UI labels are “Miễn phí” and “Dành cho học viên AIO”. Do not use “Premium”
before billing entitlement exists.

## Ownership and CMS

- Only Admin or Super-admin creates a roadmap.
- Creator becomes its single immutable owner.
- Ownership transfer does not exist.
- Owner represents responsibility and content-completion deadline, not an
  authorization boundary.
- Every Admin and Super-admin can CRUD every roadmap.
- Public may show owner name/avatar where needed; never expose learner lists.

Admin/Super-admin learner profiles may show Clerk name/avatar/email, role,
started roadmaps, progress, completed content, favorites, and last activity.
Only Super-admin manages roles. Identity remains owned by Clerk.

## Public routes and discovery

- `/fields/[slug]`: always follows Field selection, including one roadmap.
- `/roadmaps/[slug]`: canonical public roadmap URL.
- `/notion/[slug]`: document route in public and CMS zones.
- Legacy singular or ID links redirect to the canonical slug URL.

Explorer hides Fields without an accessible published roadmap. Field Roadmaps
filters by real role-tag data and sorts by popularity, first publish time, or
A–Z. Popularity is unique learners with progress, never page views. Search only
returns accessible `PUBLISHED + PUBLIC` records. PRIVATE is never listed.

## Composition and canvas

Composition is persisted in PostgreSQL and mock storage with equal semantics:

- a block may belong to multiple canvases;
- coordinates belong to a canvas membership;
- edges are persisted entities with `solid | dashed` kind;
- `parentId` remains only during compatibility migration.

Public canvas is read-only: pan/zoom, Zen, Fullscreen, open detail/content.
Builder editing is CMS-only. A pinned, collapsible legend explains solid main
flow, dashed reference relation, required progress content, and optional
content. Edges explain flow but never lock content.

## Content and learner state

Node progress is `NOT_STARTED | IN_PROGRESS | COMPLETED`. First open sets
`IN_PROGRESS`; completion requires an explicit learner action. Progress is
stored per `user + content node`, so reused content carries completion across
roadmaps. Roadmap percent counts current required nodes.

Once a learner completes a roadmap, later required additions do not revoke the
completion. Learners who have not completed it use the new composition.
Favorite applies to roadmaps only.

Learner count is unique users with progress: per roadmap, a user who started
content in its composition; per Field, a user who started one of its roadmaps.

Key Results are an ordered read-only learner outcome list. Attachments inherit
FREE/INTERNAL access; Admin/Super-admin upload/delete supported image, PDF, and
office formats. Executables are rejected. Comments are not in current scope.

## Draft, publish, archive

New roadmap starts DRAFT. Initial publish requires title, unique slug,
description, Field, thumbnail, one required content node, and no deleted
content reference.

Published-roadmap edits use a working draft. Public keeps the latest published
revision until atomic publish updates metadata, content, composition, and
positions together. Draft can be discarded.

Moving back to DRAFT blocks public access but retains progress and favorites. A
never-published draft without learner data may be deleted. A roadmap previously
published or with learner data is archived and restorable. Field deletion is
allowed only with no roadmap and never cascades to roadmaps.

## Notifications and notebook

Publishing new content creates one in-app notification for learners who started
or favorited the roadmap. Email is opt-in. Draft edits send nothing.

Production notebook execution uses Go kernel-server/Jupyter. Guest can view
committed code/output but must authenticate before Run. Execution errors stay
visible. Fixture/Pyodide fallback is local-development only.

