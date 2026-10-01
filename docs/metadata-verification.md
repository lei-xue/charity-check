# Metadata and layout maintenance — local verification

This report records the earlier local metadata/layout maintenance pass. Its references to 111 records and unpublished assets describe that historical checkpoint only; the Phase 4 addendum in `docs/implementation.md` records the current 500-record deployed state.

## Changes

| Area | File | Change |
| --- | --- | --- |
| Desktop alignment | `src/pages/Browse.tsx` | Large-breakpoint filter grid widened from five columns to six: search spans two columns, state one, cause one, revenue two (revenue itself keeps its inner two-column pair). Every control now carries an explicit 40px height and a zero minimum width; labels carry a fixed minimum line height so they stay on one 16px line. |
| Header overflow | `src/App.tsx` | Header row stacks (`flex-col`) below `sm` and returns to a single row at `sm+`; the sticky header, nav landmark and three nav links are unchanged. |
| Brand mark | `src/components/BrandMark.tsx`, `public/favicon.svg` | Original burgundy document + magnifier mark replaces the "CC" text badge and the Vite template favicon. No shield and no check-mark imagery anywhere in the app; the header SVG is `aria-hidden`. |
| Static metadata | `index.html` | Canonical, truthful title/description, Open Graph, Twitter card, theme colour and a minimal `WebSite` JSON-LD. No `SearchAction`, no rating/review structured data. |
| Crawl hints | `public/robots.txt`, `public/sitemap.xml` | Robots allows crawling and points at the sitemap; the sitemap lists `https://charitycheck.leixue.dev/` only and contains no hash routes. |
| Social asset | `scripts/brand/social-card.svg`, `scripts/render-social-card.mjs`, `public/og-image.png` | Project-specific 1200x630 card rendered from the original SVG with the Playwright already installed on this machine. |
| Regression tests | `tests/metadata.test.ts`, `docs/verification/verify-browser.mjs` | Static metadata assertions in the `node --test` suite; browser layout/metadata assertions at 320, 390, 768, 1024 and 1440 px in the existing production-dist interception harness. |

## Measured local results

Node.js 26.7.0 / npm 11.19.0, working tree `9a1347b` + uncommitted changes:

```
npm test    -> tests 72, pass 72, fail 0
npm run lint -> oxlint, exit 0, no warnings
npm run build -> tsc -b && vite build, exit 0
                 dist/index.html 3.07 kB | dist/assets/index-C5xCVotI.css 23.12 kB | dist/assets/index-Dj94gqJA.js 347.31 kB
```

`tests/metadata.test.ts` adds 13 assertions: single `<title>`, descriptive and
truthful title/description, canonical URL, complete Open Graph and Twitter
metadata (absolute HTTPS PNG URL, 1200x630, non-empty alt, `en_US` locale,
site name, theme colour), unique meta tags, valid minimal `WebSite` JSON-LD
with no search action or rating, robots.txt, homepage-only sitemap without
hashes, a real 1200x630 PNG social card read from its IHDR bytes, and a
favicon/brand mark that uses the burgundy palette without shield or check
imagery.

Browser regression, production `dist/` served by static route interception in
bundled Chromium (no listening server, no mocked responses):

```
records 111 | viewports [320,390,768,1024,1440] | deep record loop at [390,1440]
checks 1978 | failed 0 | externalRequests [] | errors []
```

Measured filter-control baseline (`width x height @ viewport top`, from the
report JSON):

| Viewport | filter-q | filter-state | filter-cause | filter-min | filter-max |
| --- | --- | --- | --- | --- | --- |
| 320 | 256x40 @257 | 256x40 @329 | 256x40 @401 | 124x40 @473 | 124x40 @473 |
| 390 | 326x40 @257 | 326x40 @329 | 326x40 @401 | 159x40 @473 | 159x40 @473 |
| 768 | 704x40 @209 | 346x40 @281 | 346x40 @281 | 348x40 @353 | 348x40 @353 |
| 1024 | 312x40 @209 | 150x40 @209 | 150x40 @209 | 152x40 @209 | 152x40 @209 |
| 1440 | 312x40 @209 | 150x40 @209 | 150x40 @209 | 152x40 @209 | 152x40 @209 |

At every width the `Min revenue` and `Max revenue` labels measure 16px (one
line, previously 32px for `Max revenue`), both revenue inputs share the same
top and the same width, and every control is 40px tall with `min-width: 0`.
At 1024/1440 the whole filter row shares one baseline (top 209).

The same harness also asserts, at each of the five widths: a single `<title>`,
the built title/canonical/`og:image`/theme colour, a served `image/svg+xml`
favicon (HTTP 200), a decoded 1200x630 social card, a sticky header that
survives scrolling, exactly three visible named nav links with no header
overflow, and no horizontal page overflow on Home, Browse, About or an org
detail. The existing 111-record deep loop at 390/1440 still passes unchanged.

Social card render (Playwright reused from the machine's existing install; no
dependency added to this manifest):

```
PLAYWRIGHT_REQUIRE_FROM=/root/.hermes/profiles/dev-mate/cache/scratch/mindbridge/package.json \
  node scripts/render-social-card.mjs
-> {"source":"scripts/brand/social-card.svg","target":"public/og-image.png",
    "width":1200,"height":630,"bytes":54609}
```

## Limits — what this does not show

- These are local implementation checks. Production metadata, image delivery and
  layout must be verified again after the coordinator publishes the changes.
  Declared canonical/Open Graph URLs alone do not establish a live deployment.
- The browser harness serves the compiled `dist/` through request interception
  and aborts every off-origin request; it is not a production-site visit, and
  `npm run build` must be run before the harness.
- The favicon check confirms the asset is served as SVG at HTTP 200, not how a
  specific browser tab renders it at 16px.
- The 1200x630 PNG was rendered by bundled Chromium on this host, so its
  typography uses the host's fallback sans-serif rather than a web font. Text
  bounding boxes were measured to stay inside the 1200px canvas; the card was
  not reviewed as a design artifact in a social platform's preview tool.
- Layout checks are computed-geometry assertions with no visual diffing, and
  they cover 320/390/768/1024/1440 px only. No full keyboard, screen-reader or
  axe accessibility audit was run, and no prerelease/browser-matrix coverage
  exists. Height 900 and full record loops at 390/1440 only; intermediate
  heights and widths are untested.
- Long-tail states (an empty curated dataset, a live lookup in flight) were not
  re-measured in this pass; the existing deep loop still covers their
  rendering after navigation.
