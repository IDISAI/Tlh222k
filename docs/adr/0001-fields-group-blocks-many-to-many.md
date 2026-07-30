# Fields group roadmap blocks, many-to-many

The CMS build prompt specified `Field.roadmaps Roadmap[]` with a nullable `fieldId` foreign key, giving each roadmap exactly one Field. We kept the many-to-many relation already shipped between `Field` and `Node`, and we attach Fields to roadmap blocks rather than to the `Roadmap` wrapper. A role like "Data Engineer" genuinely belongs under both AI and Data, and a single-Field model would hide it from every learner browsing the other one; the wrapper, meanwhile, is a storage artefact no learner or admin ever sees, while blocks are what the discovery surfaces already list and filter.

## Considered options

Following the prompt literally would have meant building a second labelling relation alongside the working one — `Field ↔ Roadmap` next to `Field ↔ Node` — and then choosing which of the two any given screen believed. Collapsing the existing relation to one Field per block would have been the cheaper migration, but it destroys memberships that cannot be recovered, and it is a one-way door: many-to-many can always be narrowed later, never widened back.

## Consequences

Roadmap counts per Field sum to more than the number of roadmaps that exist. Every count in the CMS — the sidebar tally, the Field Workspace sub-header, the Lĩnh vực table column — means "appears here", not "belongs here", and copy should not imply otherwise.

Ordering blocks within a Field requires an explicit join model carrying a position, because an implicit many-to-many has nowhere to put one. A block sitting in two Fields holds a position in each, independently.

Deleting a Field can leave a block in no Field at all. Such a block still exists and still opens by direct link, but no longer appears on any discovery path, so deletion confirmations name those blocks explicitly.
