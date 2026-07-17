# Design System — Airbnb-style tokens

Canonical reference for the platform's visual language. The token layer is
implemented in `packages/ui/src/styles/globals.css` (shadcn CSS variables);
this doc is the source spec. Supersedes the earlier Notion-style draft.

## Core rules

- **One accent.** Rausch `#ff385c` carries every primary CTA, save/heart
  state, and brand link. Pages are 90% white + ink with one or two Rausch
  moments. Never introduce a second structural accent.
- **Pure white canvas** `#ffffff`, ink `#222222` (never pure black).
- **Hairlines over shadows.** Default border `#dddddd`; soft divider
  `#ebebeb`; strong stroke `#c1c1c1`.
- **One shadow tier** (`--shadow-float`):
  `rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px`
  — hover-floated cards, search pill, dropdowns. Everything else flat.
- **Soft shapes.** Buttons 8px, cards ~14px, pills/orbs fully rounded. No
  hard corners on interactive elements.
- **Modest type weights.** Display 500–700 at 20–28px; body 400/16px. The
  only loud type moment is a 64px/700 "rating display" pattern.
- **Focus = ink.** Inputs thicken to a 2px `#222222` border on focus — no
  glow, no colored ring.

## Token mapping (shadcn vars → Airbnb)

| shadcn var | Value | Airbnb token |
|---|---|---|
| `--background` | `#ffffff` | canvas |
| `--foreground` | `#222222` | ink |
| `--primary` | `#ff385c` | Rausch |
| `--primary-foreground` | `#ffffff` | on-primary |
| `--secondary` / `--muted` | `#f7f7f7` | surface-soft |
| `--accent` | `#f2f2f2` | surface-strong |
| `--muted-foreground` | `#6a6a6a` | muted |
| `--destructive` | `#c13515` | error |
| `--border` / `--input` | `#dddddd` | hairline |
| `--ring` | `#222222` | ink focus |
| `--radius` | `0.5rem` | 8px buttons |
| `--shadow-float` | triple stack above | the one shadow tier |

Unmapped Airbnb tokens (use raw values when needed): rausch-active
`#e00b41`, rausch-disabled `#ffd1da`, body `#3f3f3f`, muted-soft `#929292`,
hairline-soft `#ebebeb`, border-strong `#c1c1c1`, legal-link `#428bff`,
scrim `#000000/50%`. Sub-brand (Luxe `#460479`, Plus `#92174d`) — sub-brand
surfaces only, never mainline.

## Typography

Font: Airbnb Cereal VF is proprietary — the repo uses **Inter** (closest
substitute per the spec) via the existing `--font-sans`. Scale highlights:

| Role | Size/Weight | Notes |
|---|---|---|
| rating-display | 64/700 | the single loud moment |
| display-xl | 28/700 | page h1 |
| display-lg | 22/500 | detail h1 |
| display-md | 21/700 | section heads |
| title-md | 16/600 | card titles |
| body-md | 16/400, lh 1.5 | default body |
| body-sm | 14/400 | meta lines |
| caption | 14/500 | field labels |
| badge | 11/600 | floating pill badges |

## Spacing / layout

4px base unit. Section bands 64px vertical; card grids compress to 16px
gutters ("open hero, dense marketplace below"). Content max ~1280px;
detail pages ~1080px. Grids reduce column count at breakpoints (744 /
1128 / 1440), never reflow rows.

## Full source spec

The complete extracted spec (components: search pill, property cards,
reservation card, date picker, nav tabs, footer; responsive/touch rules;
known gaps) lives in the design notes accompanying this file's PR. Apply
component-level patterns incrementally — the token layer above is global.
