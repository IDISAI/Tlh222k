# Requirements Document

## Introduction

The Roadmaps Page UI (`/roadmaps`) is the public-facing catalogue where learners discover and navigate to learning roadmaps. The current page already renders a basic grid of `RoadmapCard` components. This spec formalises and extends that foundation: hero section, search/filter, pagination or infinite scroll, empty/error states, progress indicators for authenticated users, and full accessibility compliance — all within the existing neobrutalist design system (`packages/ui`, Tailwind v4).

The page lives in `apps/web/app/roadmaps/page.tsx` and delegates list logic to `packages/core/src/roadmap/components/RoadmapList.tsx`. Domain data comes from `RoadmapService.list()` (mock-backed; real backend via `NEXT_PUBLIC_SVC_API_URL`).

---

## Glossary

- **RoadmapsPage**: The Next.js page rendered at `/roadmaps` in `apps/web`.
- **RoadmapList**: The `"use client"` component in `packages/core/src/roadmap/components/RoadmapList.tsx` that fetches and renders the roadmap grid.
- **RoadmapCard**: Individual card component representing one published roadmap; links to `/roadmap/{roadmap.id}`.
- **Roadmap**: A published `role` or `skill` block node; type defined in `packages/core/src/roadmap/types.ts`.
- **NodeCount**: The number of direct child nodes belonging to a roadmap block.
- **ProgressBadge**: A visual overlay on a `RoadmapCard` showing the authenticated user's completion percentage for that roadmap.
- **HeroSection**: The page header area containing the page title, subtitle, and optional call-to-action.
- **SearchBar**: An input field allowing the user to filter the roadmap list by title keyword.
- **FilterPanel**: UI controls that allow filtering roadmaps by category/node type.
- **LoadingState**: A skeleton placeholder grid shown while roadmap data is in flight.
- **ErrorState**: A message panel shown when the data fetch fails, with a retry action.
- **EmptyState**: A message panel shown when no published roadmaps match the current filter/search.
- **InfiniteScroll**: A load-more pattern that fetches additional roadmaps as the user scrolls to the bottom of the list.
- **ProgressService**: `packages/core/src/roadmap/progress/progress.service.ts` — stores per-node completion status in `localStorage`; exposes `myProgress()`.

---

## Requirements

### Requirement 1: Page Layout and Hero Section

**User Story:** As a learner, I want a clear, welcoming page header when I land on `/roadmaps`, so that I understand the purpose of the page immediately.

#### Acceptance Criteria

1. THE `RoadmapsPage` SHALL render a `HeroSection` containing a page title and a subtitle above the roadmap grid.
2. THE `HeroSection` SHALL display the title "Learn to code" and the subtitle "Choose your path." as default copy (matching the current implementation).
3. WHEN the viewport width is less than 768px, THE `HeroSection` SHALL render the page title at a minimum font size of 24px and the subtitle at a minimum font size of 16px, and SHALL apply a minimum vertical padding of 16px above and below the hero content.
4. THE `RoadmapsPage` SHALL apply a maximum content width of 1152px (`max-w-6xl`) and horizontal padding of 24px (`p-6`) to maintain the existing layout contract.
5. THE `RoadmapsPage` SHALL render a semantic `<main>` element as the root container for the page content.

---

### Requirement 2: Roadmap Grid Display

**User Story:** As a learner, I want to see all published roadmaps displayed in a responsive grid, so that I can browse available learning paths at a glance.

#### Acceptance Criteria

1. WHEN roadmap data loads successfully, THE `RoadmapList` SHALL display published roadmaps in a CSS grid with 1 column at viewport widths below 768px, 2 columns at viewport widths ≥768px and <1024px, and 3 columns at viewport widths ≥1024px.
2. WHEN `RoadmapService.list()` returns N items (N ≥ 1), THE `RoadmapList` SHALL render exactly N `RoadmapCard` elements.
3. WHEN `thumbnailUrl` is non-null, THE `RoadmapCard` SHALL display the thumbnail image with `object-cover` fill inside a 16:9 aspect-ratio container.
4. IF `thumbnailUrl` is null, THEN THE `RoadmapCard` SHALL display the 🗺️ emoji placeholder centered in the 16:9 area.
5. THE `RoadmapCard` SHALL display the roadmap title in uppercase, extrabold, italic typography.
6. WHEN the description is non-null and its character length exceeds 120, THE `RoadmapCard` SHALL display only the first 120 characters of the description followed by a "…" ellipsis character.
7. THE `RoadmapCard` SHALL display the node count suffixed with " chủ đề" (e.g. "12 chủ đề") below the description.
8. THE `RoadmapCard` SHALL be a navigable anchor linking to `/roadmap/{roadmap.id}` using a root-absolute `href`.
9. WHEN a `RoadmapCard` receives pointer hover, THE `RoadmapCard` SHALL apply a `-translate-y-1` CSS transform to provide a lift affordance.
10. THE `RoadmapCard` SHALL apply a 4px solid black border and a `6px 6px 0px 0px rgba(0,0,0,1)` box shadow in light mode, and a 4px solid zinc-800 border with a `6px 6px 0px 0px rgba(255,255,255,0.1)` box shadow in dark mode.
11. WHEN `RoadmapService.list()` returns an empty array, THE `RoadmapList` SHALL render the `EmptyState` panel and SHALL NOT render any `RoadmapCard` elements.
12. IF the `RoadmapService.list()` call throws or rejects, THEN THE `RoadmapList` SHALL render the `ErrorState` panel and SHALL NOT render any `RoadmapCard` elements.

---

### Requirement 3: Loading State

**User Story:** As a learner, I want to see placeholder skeletons while the roadmap list is loading, so that the page feels responsive and I know content is on its way.

#### Acceptance Criteria

1. WHILE the roadmap data fetch is in progress, THE `RoadmapList` SHALL render a skeleton grid using the same responsive column breakpoints as the roadmap grid (1 column below 768px, 2 columns at 768–1023px, 3 columns at ≥1024px).
2. WHILE the roadmap data fetch is in progress, THE `RoadmapList` SHALL render exactly 6 skeleton cards, each 256px tall (`h-64`) with `rounded-xl` corners.
3. THE `RoadmapsPage` route SHALL export a `loading.tsx` file that renders 6 skeleton cards in the same 1/2/3-column responsive grid as `RoadmapList`, providing the Next.js Suspense fallback before the client component hydrates.
4. WHEN the data fetch completes successfully, THE `RoadmapList` SHALL replace all 6 skeleton cards with the roadmap grid.
5. WHEN the data fetch completes with an error, THE `RoadmapList` SHALL replace all 6 skeleton cards with the `ErrorState` panel.

---

### Requirement 4: Error State

**User Story:** As a learner, I want to see a clear error message with a retry option when the roadmap list fails to load, so that I can recover without refreshing the whole page.

#### Acceptance Criteria

1. IF the `RoadmapService.list()` call throws or rejects, THEN THE `RoadmapList` SHALL render the `ErrorState` panel instead of the grid.
2. THE `ErrorState` panel SHALL display the message "⚠ Không thể tải dữ liệu".
3. THE `ErrorState` panel SHALL display a "Thử lại" button.
4. WHEN the "Thử lại" button is activated, THE `RoadmapList` SHALL call `RoadmapService.list()` again.
5. WHEN the retry call is in flight, THE `RoadmapList` SHALL display the loading skeleton state and the "Thử lại" button SHALL be disabled until the call completes.
6. WHEN the retry call succeeds, THE `RoadmapList` SHALL replace the `ErrorState` panel with the roadmap grid.
7. WHEN the retry call also throws or rejects, THE `RoadmapList` SHALL re-render the `ErrorState` panel with the "Thử lại" button re-enabled.

---

### Requirement 5: Empty State

**User Story:** As a learner, I want a clear message when no roadmaps are available, so that I am not confused by a blank page.

#### Acceptance Criteria

1. WHEN `RoadmapService.list()` returns an empty array, THE `RoadmapList` SHALL render the `EmptyState` panel and SHALL NOT simultaneously render the roadmap grid.
2. WHEN the `EmptyState` panel is rendered, THE `RoadmapList` SHALL display the 📭 emoji and the message "Chưa có roadmap nào".
3. WHEN the `EmptyState` panel is rendered, THE `RoadmapList` SHALL apply a 4px solid black border and a `6px 6px 0px 0px rgba(0,0,0,1)` box shadow to the panel container (matching neobrutalist card styling).
4. WHILE the roadmap data fetch is in progress, THE `RoadmapList` SHALL NOT render the `EmptyState` panel even if the previous render showed an empty result.

---

### Requirement 6: Search and Keyword Filtering

**User Story:** As a learner, I want to filter roadmaps by typing a keyword, so that I can quickly find a roadmap relevant to my goals.

#### Acceptance Criteria

1. THE `RoadmapList` SHALL render a `SearchBar` text input above the roadmap grid.
2. WHEN a user types into the `SearchBar`, THE `RoadmapList` SHALL, on each keystroke, filter the displayed cards to those whose `title` contains the current input value (case-insensitive, accent-insensitive). The `SearchBar` input SHALL accept a maximum of 200 characters.
3. WHEN the `SearchBar` input value becomes an empty string (length = 0) — whether by backspace, delete, or any programmatic clear — THE `RoadmapList` SHALL hide the `EmptyState` panel if shown and display the full unfiltered roadmap grid.
4. WHEN the filtered result set is empty, THE `RoadmapList` SHALL render the `EmptyState` panel and SHALL NOT simultaneously render the grid. THE `EmptyState` panel SHALL display the message "Không có roadmap phù hợp với tìm kiếm."
5. THE `SearchBar` SHALL include a programmatically associated label with the value "Tìm roadmap" using either `<label htmlFor>` or `aria-label`.
6. THE `SearchBar` filtering SHALL operate on the client-side against already-fetched data without triggering a new network request.

---

### Requirement 7: Progress Badges for Authenticated Users

**User Story:** As an authenticated learner, I want to see my completion progress on each roadmap card, so that I can track which paths I have started and how far along I am.

#### Acceptance Criteria

1. WHILE the user is authenticated, THE `RoadmapCard` SHALL display a `ProgressBadge` overlay in the card's thumbnail area for roadmaps where progress > 0%.
2. THE `ProgressBadge` SHALL display a filled progress bar whose fill width equals the completion percentage of the total bar width, and a percentage label formatted as a rounded integer followed by "%" (e.g. "42%"), both derived from `ProgressService.myProgress()` for the matching `roadmapId`. The progress bar fill and percentage label SHALL use the emerald-500 color.
3. WHEN the user has not started a roadmap (0% completion), THE `RoadmapCard` SHALL NOT display the `ProgressBadge` for that roadmap.
4. WHILE the `RoadmapList` is in a loading or error state, THE `RoadmapCard` SHALL NOT display any `ProgressBadge` overlays.
5. WHILE the user is not authenticated, THE `RoadmapList` SHALL NOT render any `ProgressBadge` overlays on any `RoadmapCard`.
6. THE `ProgressBadge` SHALL be positioned as an overlay in the bottom-left corner of the thumbnail area and SHALL NOT overlap the roadmap title element.

---

### Requirement 8: Accessibility

**User Story:** As a learner using assistive technology, I want the roadmaps page to be fully navigable and perceivable, so that I can access the content regardless of disability.

#### Acceptance Criteria

1. THE `RoadmapsPage` SHALL use semantic HTML elements: `<main>` for page content, `<h1>` for the page title, `<h3>` for each card title, and `<ul>`/`<li>` (or equivalent) for the roadmap grid items.
2. THE `RoadmapCard` thumbnail image SHALL include an `alt` attribute equal to the roadmap title when `thumbnailUrl` is non-null.
3. WHEN `thumbnailUrl` is null, THE `RoadmapCard` emoji placeholder element SHALL include `aria-hidden="true"` so screen readers skip decorative content.
4. THE `SearchBar` SHALL have a programmatically associated label using `<label>` with `htmlFor` or `aria-label`.
5. THE `RoadmapsPage` SHALL maintain a color contrast ratio of at least 4.5:1 for body text (below 18pt normal / 14pt bold) and at least 3:1 for large text (≥18pt normal or ≥14pt bold) against their backgrounds in both light and dark modes.
6. WHILE the roadmap data fetch is in progress, THE `RoadmapList` skeleton container SHALL carry `aria-busy="true"`. WHEN the fetch completes (success or error), THE skeleton container SHALL set `aria-busy="false"`.
7. THE "Thử lại" retry button in the `ErrorState` SHALL be a native `<button>` element (or equivalent with `role="button"`) and SHALL display a focus ring of at least 2px width with at least 3:1 contrast ratio against the adjacent background color.
8. THE `RoadmapsPage` SHALL be fully operable via keyboard alone: all interactive elements (search input, roadmap card links, retry button) SHALL be reachable in a logical tab order and activatable without a pointer device.

---

### Requirement 9: Dark Mode

**User Story:** As a learner using dark mode, I want the roadmaps page to adapt its color scheme, so that it is comfortable to view in low-light conditions.

#### Acceptance Criteria

1. IF the user's system or app preference is dark, THEN THE `RoadmapCard` background SHALL darken to zinc-900, the border SHALL lighten to zinc-800, and the box shadow SHALL invert to `6px 6px 0px 0px rgba(255,255,255,0.1)`.
2. IF the user's system or app preference is dark, THEN the error and empty state panels SHALL darken their background to zinc-900, lighten their border to zinc-800, and invert their box shadow to `6px 6px 0px 0px rgba(255,255,255,0.1)`.
3. IF the user's system or app preference is dark, THEN THE `SearchBar` input SHALL use the `bg-background` semantic token for its background and the `border-border` semantic token for its border, consistent with the Tailwind v4 token system defined in `packages/ui/src/globals.css`.

---

### Requirement 10: Performance and Data Freshness

**User Story:** As a learner navigating back from a roadmap detail page, I want to see an up-to-date list without waiting for a full page reload, so that my browsing is fast and consistent.

#### Acceptance Criteria

1. WHEN the browser restores the `/roadmaps` page from the bfcache (back/forward navigation), THE `RoadmapList` SHALL trigger a background re-fetch of `RoadmapService.list()` and update the grid with the new data without replacing the currently displayed grid with a loading skeleton.
2. THE `RoadmapList` SHALL register a listener for the `"pageshow"` window event and, WHEN `event.persisted` is `true`, SHALL trigger the background re-fetch described in criterion 1.
3. THE `RoadmapsPage` SHALL opt out of Next.js static caching using `export const dynamic = "force-dynamic"` (or an equivalent `no-store` fetch directive), ensuring the page is not served from a stale Next.js cache. The page SHALL be regenerated on each request so that roadmaps published within the last 60 seconds are visible.
4. WHEN `RoadmapService.list()` resolves within 200ms from component mount, THE `RoadmapList` SHALL render the complete roadmap grid within 500ms of component mount as measured from the `performance.now()` timestamp recorded at mount.
5. WHEN the background re-fetch triggered by bfcache restoration throws or rejects, THE `RoadmapList` SHALL retain the previously displayed grid and SHALL NOT transition to the `ErrorState` panel.
