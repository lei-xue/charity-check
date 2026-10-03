# UI/UX Review — Emil pass (October 2026)

Scope: legibility, hierarchy, primary actions, keyboard/touch semantics,
loading/error/empty feedback, and large-list navigation on the 500-record
browse page. Data, EIN rules, IRS/ProPublica distinctions, source dates,
disclaimers and the manual-submit live lookup were left unchanged. No
animation library, overscroll suppression, zoom disabling or focus hiding
was introduced.

## Before / After / Why

| Before | After | Why |
| --- | --- | --- |
| Browse rendered all 500 organization cards in one grid; long scroll and heavy DOM (confirmed by DOM count on `/#/browse`). | Local pagination, 12 cards per page, via `src/lib/pagination.ts`. All 500 records remain reachable; the ordered union of all pages equals the dataset (tested). | Large lists stay fully navigable without a 500-node grid; lighter render and clearer position in the result set. |
| Result summary read only "Showing N of 500 charities". | Accurate visible range ("Showing 1–12 of N matching charities (500 total)"), page X of Y, and a zero-results message with no bogus range. | Readers can tell where they are and how much remains; empty filters no longer imply a range that does not exist. |
| No page state in the URL. | `page` is a shareable search parameter; any filter change deletes it (reset to page 1); invalid, negative, NaN or out-of-range values are clamped to the nearest valid page instead of dropping records. | Links are reproducible and stale page numbers cannot hide data. |
| No skip link; keyboard users tabbed through the header on every route. | Skip-to-main-content link (`#main-content`) revealed on focus, without suppressing the browser's default focus styles. | Faster keyboard journey; visible focus is preserved, not restyled away. |
| Header nav links ~30px tall; filter controls 40px with 14px text and 12px uppercase labels. | Nav links, pagination and Clear-filters controls are 44px tall; filter inputs use 16px text with 14px sentence-case labels at aligned geometry. Lookup input also 16px with 44px buttons. | Meets touch-target expectations and avoids mobile auto-zoom on <16px inputs; labels stay legible without losing the aligned filter grid. |
| Footer showed build time and short SHA only. | Footer shows package version (0.0.1), UTC build time and injected short SHA; the version is read from `package.json` at build time, never hardcoded. | Version, lock file and visible footer can be checked against each other; SHA/time remain auto-injected. |
| Clicking Next/Previous at the bottom of a page committed the new page but left the reader at the old scroll position with focus on the pressed button (measured at 390px: after Next, scrollY 2380, new first card top −1727px, header bottom 109px — all new records above the viewport). | Explicit pagination clicks now set a user-action flag; after the DOM commit the labelled result summary (`role="status"`, `tabIndex={-1}`) receives focus and is scrolled just below the measured sticky header (measured: summary top 125px vs header bottom 109px, scrollY 484), so the next Tab reaches the new records. Filter typing, initial load and implicit clamping never trigger scroll/focus; scroll behavior is `auto` (reduced-motion safe). The live range announcement and shareable `?page=N` URL are unchanged. | Keyboard and sighted readers start each new page at the results, not below them; the focus target is stable and labelled so the announced range and the visible position agree. |
| Clearing a non-matching search via "Clear all filters" unmounted the clicked button and left `document.activeElement` on `<body>`. | Both clear buttons restore focus to `#filter-q` after clearing (measured: activeElement is `filter-q` after click). Typing keeps focus in the input and fires zero remote requests (measured: 0), preserving manual-submit lookup and reset/clamping behavior. | Focus is never dropped to the document body; keyboard users stay in the filter context they were working in. |

UI style basis: official Emil Kowalski skills upstream
https://github.com/emilkowalski/skills, pinned at e8a175de22ae1e49370fc144c1f3bb9aeedf988d (MIT).

## Test commands and actual results (this workdir, uncommitted)

- `npm test`: 89 passed, 0 failed. New `tests/pagination.test.ts` verifies the
  ordered union of all pages equals the 500 source records, the last-page
  contents, filter-reset/clamping behavior, and empty-result ranges.
  `tests/metadata.test.ts` now pins the footer contract: semver package
  version matching `package.json` and `package-lock.json` (root entry
  included), `__APP_PACKAGE_VERSION__` read from `package.json`, and no
  hardcoded version string in `vite.config.ts`.
- `npm run lint` (oxlint): passed, no findings.
- `npm run build` (`tsc -b && vite build`): passed.
- `scripts/browse-focus-regression.mjs` (repo-local, dev-only; Playwright is
  resolved from this repository first, or from an explicitly provided
  `PLAYWRIGHT_MODULE_PATH` pointing at an existing Playwright package
  directory — never from a hardcoded sibling path; missing tool prints
  install/provided-module guidance and exits nonzero without launching;
  `PREVIEW_URL` override, no fixture or toggle shipped): historical
  pre-release evidence — run against the built preview at
  `http://127.0.0.1:8803` — 10/10 checks passed: Next focuses the
  `role="status"` summary; summary top 125px vs header bottom 109px
  (scrollY 484); shareable `?page=2` URL; Tab after the summary reaches a
  record link; Clear all filters restores focus to `#filter-q`; clearing
  resets URL params; the inline Clear filters button also restores focus to
  `#filter-q`; Next -> zero-result filter -> clear -> Next to the same page
  again re-focuses the summary (regression: a stale per-page guard
  suppressed the repeat pagination — fixed by gating on the explicit user
  action alone and clearing pending intent on filter/clear); typing keeps
  focus in `#filter-q`; typing fires 0 remote requests. The coordinator
  scratch verifier (320/390/1440px) also passes all focus checks after this
  fix.
- Version bump: `npm version 0.0.1 --no-git-tag-version` updated
  `package.json` and `package-lock.json` together (both read back as 0.0.1).

## Verification status and pending gates

- Coordinator-measured, local and automated: browse traversal across all 42
  pages reached all 500 unique records in order; filter changes reset to page
  1 and the no-results state works; the HashRouter skip-link bug was fixed
  with preventDefault + explicit focus + measured sticky-header offset; the
  root 200%-text grid reflow overflow was fixed and re-run clean. The initial
  pagination traversal loop raced React commits; waiting for the exact page
  caption made traversal pass 500/42 — a test-harness race, not a data loss.
- The UI automated gate is PASSED subject to final review; it is not a global
  security certification.
- PENDING: physical-device (real phone) and manual screen-reader review — the
  evidence above is automated and local, not real hardware or subjective
  visual sign-off.
- PENDING: online new version is unpublished; deploy/publish is a separate
  authorized gate and final live checks against the deployed URL remain open.
- No sorting and no debounce were added to local filtering; the remote
  ProPublica lookup remains manual-submit only, as scoped.
- No raw data (`src/data/charities.json`, `dataset-meta.json`) or generated
  assets were modified; no commit, push or deployment was performed.
