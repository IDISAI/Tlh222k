# 1. Search ranks without an LLM

Date: 2026-07-24

## Status

Accepted

## Context

`/roadmaps` needs to answer queries where the user describes what they want
rather than naming it. Four representative queries, given by the product owner:

1. `học toán` → the mathematics roadmaps
2. `ngoại ngữ` → the language roadmaps (Chinese, Japanese, English, Korean)
3. `ngôn ngữ lập trình` → Python, C++, JavaScript, Go
4. `tôi đã biết Python, nên học gì tiếp` → what builds on Python

None of the four shares a literal word with the titles it should return. The
existing search matched the **title only**, as a substring, so queries 2 and 3
returned **zero results** against a catalogue that contained exactly what was
asked for.

The obvious reading is that this needs semantic search — embeddings, or an LLM
reading the query. Before building either, we made the corpus real (19 published
roadmaps with Vietnamese titles and descriptions, seeded by
`pnpm -F @workspace/db seed:catalog`) and measured what plain token counting
does on it.

## Measurement

Same corpus, two strategies. "Wide" = split the query into tokens, look for each
token in title + description + Field names, rank by how many tokens matched.

| Query | Title-only, substring | Wide, token-scored |
|---|---|---|
| `toán` | 1 (`Toán rời rạc`) | Đại số, Xác suất, Toán rời rạc, Giải tích |
| `ngoại ngữ` | **0** | 4 language roadmaps at score 2; noise at 1 |
| `ngôn ngữ lập trình` | **0** | Python·4, JavaScript·4, Backend·4; noise at 2 |
| `tôi đã biết python nên học gì tiếp` | — | **Machine Learning·5** ranked first |

Query 4 is the interesting one. It ranked correctly with no prerequisite data
and no intent parsing, because the Machine Learning description contains "Bước
tiếp theo sau khi đã vững Python". The relationship was already encoded — in
prose, by whoever wrote the description.

Three things produce the difference, none of them AI:

1. Searching the **description**, where related concepts actually appear.
2. Searching the **Field names**. "Ngoại ngữ" matches no title in the catalogue;
   it matches the label. The discovery-label feature turned out to be a
   hand-authored semantic layer.
3. **Tokenising and scoring** instead of substring-matching the whole query.

## Decision

Rank search results by token score across title (3), Field name (2), and
description (1). No LLM, no embeddings, no pgvector.

An LLM path was designed in full before being rejected: a Next.js route holding
the API key, login-gated to bound abuse, two-tier so keystroke filtering
survived a slow or failed call. It was dropped on cost. There is no free Claude
model; at ~2500 input tokens per query the estimated spend was $120–540/month
depending on model, to improve on a measured result that already answered all
four queries.

## Consequences

- Search stays client-side on already-fetched data, filtering on every
  keystroke. No API key, no server route, no per-query cost, no rate limiting,
  no login requirement, no third-party data egress.
- **Result quality is bounded by description quality, not by the algorithm.**
  Every number above depends on descriptions that name adjacent concepts. A
  catalogue of entries described as "Học Python" would score far worse — and an
  LLM would not rescue that, because it reads the same short description. The
  lever is editorial, not technical.
- The catalogue is fetched whole for the card grid, so ranking it costs nothing
  extra. This holds while the catalogue is small (~21 entries). At a few hundred
  it needs server-side filtering, and that is the point to re-open the semantic
  question with real query logs rather than four example queries.
- Prerequisites are still worth storing. They feed display ("Cần biết trước:
  Python"), a ranking boost, and reverse lookup ("học xong Python có thể học…")
  — none of which needs an LLM.
