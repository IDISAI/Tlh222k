# Roadmap Platform

Shared vocabulary for roadmap discovery, composition, and learning content.

## Language

**Field**:
A top-level visual discovery domain with editorial metadata that groups reusable roadmap blocks. A block may belong to multiple Fields.
_Avoid_: category, tag, one-owner roadmap container

**Draft Field**:
A Field editable by Admin or Super Admin but hidden from public discovery.
_Avoid_: unpublished roadmap block

**Published Field**:
A Field visible in the public Field Explorer and containing at least one public roadmap block.
_Avoid_: approved Field, active Field

**Field order**:
An editorial sequence controlled in CMS; it determines gallery order and the initial public Field.
_Avoid_: creation order, publication time

**Field image**:
A validated HTTPS `imageUrl` supplied by CMS and used unchanged for both the Field thumbnail and its full-viewport background.
_Avoid_: thumbnail image, separate hero image, upload asset

**Field slug**:
An immutable, unique URL identifier generated when a Field is created. Editing its Title never changes it.
_Avoid_: a title-derived mutable URL, display title

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
A confirmed hard delete that removes the Field and its block memberships, while preserving every roadmap block.
_Avoid_: deleting roadmap blocks, soft delete

**Roadmap block**:
A reusable role, skill, or chapter block that owns a composition canvas and may appear in multiple Fields.
_Avoid_: Field, category
