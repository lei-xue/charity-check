# CharityCheck

An English-only web application for inspecting public U.S. nonprofit records and historical, self-reported Form 990 figures before donating. It is informational, not a trust rating, fraud detector, or certification of current tax exemption or deductibility.

## Current features

- A curated snapshot of 500 selected U.S. charitable organizations, generated October 1, 2026. Individual source records may have been retrieved earlier.
- Local name, EIN and city search, with state, cause and revenue filters. Browse results are paginated locally at 12 records per page; the page is part of the shareable URL, any filter change returns to page 1, and out-of-range page values are clamped so no record becomes unreachable.
- Organization profiles with source-reported classification, filing periods, historical financial figures and source links.
- An optional ProPublica lookup from the existing Browse search, through a bounded first-party Cloudflare Worker. Submitting explicitly sends the query to Cloudflare and ProPublica; local filters do not apply upstream. Every record on each source page is retained, with Previous/Next navigation and a visible 10,000-result source cap.
- Lookup cancellation, stale-response protection, retry and one 12-second deadline.
- A 40-entry memory-only live-result cache: successful identical submissions and source-page revisits reuse data for 15 minutes, preserve the retrieval time, and support explicit forced Refresh/Retry. Retry stays on the failed source page. A failed refresh retains only that same query/page's cached data with a stale label; it never becomes a successful empty result. Reload clears this application cache, and the Worker HTTP `no-store`/privacy policy is unchanged.
- Keyboard support includes a skip-to-main-content link; navigation and page controls meet a 44px touch target and filter inputs use 16px text.
- The footer shows the package version, UTC build time and an injected short commit SHA.

See [UI/UX review](uiux-review.md) for the Before/After/Why findings of the browse-pagination and accessibility pass. See [v0.0.2 cache acceptance](cache-acceptance-v0.0.2.md) for measured live-cache checks and portable browser regression commands.

Local browsing and filtering do not automatically contact the lookup API. Local searches are reflected in the hash-router URL and may therefore remain in browser history or copied links. Do not enter sensitive personal information.

## Development

Use Node.js 24 or newer for the native TypeScript test runner; this milestone was exercised with Node.js 26.7.0. No API key is required for local browsing.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

The application uses React, TypeScript, Vite, Tailwind CSS and HashRouter. Vite's relative asset base supports static hosting; this milestone does not change hosting or establish a working production URL.

## Data and provenance

- `src/data/charities.json`: the committed curated records.
- `src/data/dataset-meta.json`: source, snapshot timestamp and record count.
- `scripts/curated-expansion-manifest.json`: the 389 added EINs, source-reported legal names, expected subsection and the status code required on a successful refresh. Names and EINs are pinned together to make the curated expansion auditable.
- Source: [ProPublica Nonprofit Explorer API v2](https://projects.propublica.org/nonprofits/api).
- Current exemption and deductibility verification: [IRS Tax Exempt Organization Search](https://apps.irs.gov/app/eos/).

A snapshot date is not a filing period. Neither a fresh nor cached ProPublica response is a live IRS status check. `ProPublica record` means a source record was found; `501(c)(3) (as reported)` repeats its classification without independently establishing current eligibility. No `Public Charity` classification is inferred from NTEE activity codes. A missing extracted filing is not evidence of wrongdoing. Reported zero and absent financial amounts remain distinct.

Visitor EINs must contain nine digits or use `XX-XXXXXXX`; malformed input is not silently repaired. Validated numeric source identifiers are padded for display without rewriting the original dataset. Existing numeric organization links remain supported only when they exactly identify a curated record.

### Refreshing the snapshot

```sh
npm run data:fetch
# Retry only entries previously cached as having no search results:
npm run data:fetch -- --retry-misses
```

This explicitly runs `scripts/fetch-charities.mjs`, contacts upstream sources and can replace the committed snapshot. Review the script and resulting record count, amounts, dates and URLs before committing a refresh. The Phase 0/1 milestone did **not** refresh or expand the dataset.

## Verification and remaining scope

See [Implementation and verification](implementation.md) for measured checks and API observations. The first-party Worker has been deployed and verified with real name/EIN queries, including browser CORS and pagination. The main frontend deployment remains unverified. No accounts, payment flows, AI trust scores, multilingual interface or frontend hosting migration are included.

### Lookup backend

Source/configuration: `workers/lookup/`. Deploy with `npx wrangler deploy --config workers/lookup/wrangler.jsonc` after confirming the intended account and Workers Free plan. The Worker permits fixed ProPublica queries only; it is not an arbitrary-URL proxy. It restricts origins, methods, query length, page range, response size and upstream time, and leaves observability disabled. Changing the frontend origin requires an explicit allowlist update and a fresh CORS/browser check.
