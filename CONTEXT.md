# Roadmap Platform

Shared vocabulary for roadmap discovery, composition, and learning content.

## Language

**Field**:
A top-level visual discovery domain with editorial metadata that groups reusable roadmap blocks. A block may belong to multiple Fields. There is exactly one Field named "AI" in the system: the label on the `/roadmaps` filter strip and the titled image on the Field Explorer are the same Field rendered two ways, never two records to keep in step.
_Avoid_: category, tag, one-owner roadmap container, a filter label distinct from its Explorer scene

**Draft Field**:
A Field editable by Admin or Super Admin but hidden from public discovery. A Draft Field may hold nothing but a name: labelling a block with a Field that does not exist yet mints one on the spot, and it organises the catalogue for its editors from that moment. Learners see no trace of it. Completing it — image, description — happens later in the Field Workspace, and only a complete Field can be published.
_Avoid_: unpublished roadmap block, a Field that must be complete before it exists, a draft that reaches learners

**Published Field**:
A Field visible in the public Field Explorer. Publishing one demands a title, a slug, a description, an image, and at least one public roadmap block; keeping it published does not. A Published Field that later loses its last block stays published and keeps its scene — its Explore Field CTA simply goes dead, which is a state the design already accounts for. It is the only status a learner ever meets: one rule holds on every surface — Published is seen, Draft and Private are not — so nobody has to remember which screen makes which exception.
_Avoid_: approved Field, active Field

**Private Field**:
A complete Field — image, description, at least one roadmap block — deliberately kept out of the Field Explorer gallery and the `/roadmaps` filter strip, yet fully viewable by anyone holding its direct link. It is the state for a Field shown to a chosen audience rather than to everyone. Unlike a Draft Field, which is unfinished and unreachable, a Private Field is finished and merely unlisted.
_Avoid_: draft, hidden, admin-only, signed-in-only

**Field status**:
Exactly one of Draft, Published, or Private — the three states every Field, roadmap block, notebook, document, and media item shares. There is no review step and no archive: nothing in the system approves content, so a state meaning "awaiting approval" would name an act nobody performs.
_Avoid_: pending review, archived, a per-section state machine


An editorial sequence controlled in CMS; it determines gallery order and the initial public Field.
_Avoid_: creation order, publication time

**Field image**:
The single validated HTTPS image an editor uploads for a Field, standing for it everywhere it appears — the Explorer's full-viewport background, its thumbnail in the strip, its row in the CMS. One upload, never a set: whoever edits a Field chooses one picture and is never asked for a second. What varies between those surfaces is only the size it is served at, never which picture it is.
_Avoid_: thumbnail image, separate hero image, upload asset, a background and a thumbnail chosen apart

**Field slug**:
An immutable, unique URL identifier fixed when a Field is first saved. Editing its Title never changes it. While a Field is still being created the slug follows what is typed into the Title, purely as a convenience, and stops the moment the author types in the slug themselves — a Field titled "Artificial Intelligence" is commonly published at `/ai`. A Title is editorial and may be reworded freely; a slug is a promise made to everyone who has already linked to it.
_Avoid_: a title-derived mutable URL, display title, a slug that follows renames

**Field Explorer**:
The public homepage at `/` for discovering Published Fields. It is not the roadmap list.
_Avoid_: a second `/fields` landing page, roadmap browser

**Active Field**:
The selected Field whose image, title, description, and CTA are shown on the homepage. Selecting a thumbnail changes this scene and replaces `?field=<slug>` in the URL.
_Avoid_: current roadmap, selected category filter

**Explore Field**:
The Active Field CTA that opens `/roadmaps?field=<slug>` so the user browses only roadmap blocks in that Field.
_Avoid_: an arbitrary direct roadmap jump

**Field scene transition**:
A GSAP transition between two preloaded DOM image layers; the current scene remains visible until the requested Field image is ready.
_Avoid_: instant background replacement, WebGL UI scene

**Field deletion**:
A confirmed hard delete that removes the Field and its block memberships, while preserving every roadmap block. Only a Draft Field can be deleted: a Published or Private one must first be taken back to Draft, so the public link always dies by a deliberate act of its own rather than as a side effect of tidying up. The confirmation still has to say which blocks would be left in no Field at all, since those keep existing while dropping out of every path a learner could find them by.
_Avoid_: deleting roadmap blocks, soft delete, deleting a Field that is still published

**Visibility**:
What a viewer must be to open a roadmap block once they have found it — a separate question from Field status, which decides whether the block is shown at all. A block can be Published yet Internal: listed for everyone, opened only by some. Visibility has exactly two values, Free and Internal. There is no paid tier: nothing in the system records who has paid, so a value promising a paywall would leave content its author believed to be sold sitting open to everyone.
_Avoid_: status, published state, draft, premium, paid

**Internal**:
The visibility that admits AIO learners, Admins, and Super Admins, and nobody else. Admins are included so that whoever publishes a block can still read it back; the grant is not a reward of rank but a condition of being able to check one's own work.
_Avoid_: private, unlisted, staff-only

**AIO learner**:
A learner whose enrolment earns them Internal roadmap blocks and nothing more. They hold no editing rights: the CMS is closed to them exactly as it is to any other learner.
_Avoid_: junior admin, staff, a rank between viewer and admin

**Roadmap block**:
A reusable role, skill, or chapter block that owns a composition canvas and may appear in multiple Fields. This is what a learner browses and what a Field groups; the storage wrapper every block is filed under is invisible to learners and admins alike and is never the thing attached to a Field.
_Avoid_: Field, category, the storage wrapper a block is filed under

**Level**:
How demanding a roadmap block is — Cơ bản, Trung cấp, or Nâng cao — chosen by whoever edits the block. An editorial judgement, never counted from the block's size: a short block can be advanced and a long one gentle.
_Avoid_: difficulty score, derived from node count

**Block cover**:
The image standing in for a roadmap block wherever it is shown as a card — the Explorer browse grid, the Field Workspace canvas, the roadmap picker. Distinct from the Field image: a Field has one image for its whole scene, each block carries its own.
_Avoid_: Field image, canvas thumbnail
