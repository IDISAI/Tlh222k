# Context

Domain glossary for this repo. Terms here are the vocabulary the code, issues,
and reviews should use. When a term is ambiguous or overloaded, this file is
where it gets pinned down.

Architecture, commands, and agent workflow live in `CLAUDE.md`. Hard-to-reverse
decisions live in `docs/adr/`.

## Roadmap catalogue

**Block** — a `role` or `skill` node. A block IS a roadmap (LEGO model): it
stands alone, owns a canvas, and is reusable. The public catalogue at
`/roadmaps` lists exactly the published blocks.

**Field** (Vietnamese: *lĩnh vực*) — a discovery label such as "Web Dev", "AI",
"Ngoại ngữ", rendered as a tab on `/roadmaps`. Many-to-many with nodes: "Data
Engineer" carries both AI and Data, and surfaces under either tab.

A Field is **not** a hierarchy level. It owns no canvas, is never navigable, and
adds no nesting — it only groups. Renaming one is a single row update and every
block carrying it follows. Articles never carry Fields: an article is a leaf
inside a chapter and never reaches the public card grid, so labelling one would
be dead data.

**Prerequisite** (Vietnamese: *tiên quyết*) — a directed pair meaning "X should
be learned before Y". Distinct from every other link in the model:

| Relation | Means | Cardinality |
|---|---|---|
| `parentId` | structural containment (skill lives inside role) | one parent |
| `order` | sequence of chapters within one roadmap | integer |
| `RoadmapEdge` (`solid`/`dashed`) | **purely visual** — a line style on a canvas, no semantics | — |
| **Prerequisite** | learning order | many-to-many |

Properties, all decided deliberately:

- **Advisory, never a gate.** "Nên biết Python trước" — a learner who skips
  ahead is not blocked. `NodeStatus.locked` is a display state (an icon on an
  unstarted node), not an access-control mechanism, and prerequisites do not
  change that.
- **Attaches to any node type**, not only catalogue blocks. A chapter may
  require another chapter.
- **Results roll up.** When a prerequisite points at a chapter, the UI shows the
  role/skill card that contains it — chapters have no card of their own.
- **Acyclic.** A cycle is rejected. The existing `assertAcyclicTree` cannot be
  reused: it assumes one parent per node, and prerequisites are many-to-many —
  a DAG, not a tree.

## Search

**Match score** — how a roadmap ranks for a query. The query is folded (accents
stripped, lowercased), split into tokens, and each token is looked for in three
places with different weights:

| Where the token matches | Points |
|---|---|
| Title | 3 |
| Field name | 2 |
| Description | 1 |

The weights exist because Vietnamese writes compound words as separate
syllables, so a token can match inside an unrelated compound. Searching *toán*
(mathematics) matches the description of the C++ roadmap, which mentions *thuật
toán* (algorithm) — no tokenizer can separate those. Weighting the title and
Field above the description demotes that hit without discarding it, because a
description match is sometimes exactly right.

Search is **client-side, on already-fetched data, on every keystroke**. There is
no LLM in this path — see `docs/adr/0001-search-without-llm.md`.
