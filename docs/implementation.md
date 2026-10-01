# Implementation and Verification

The Phase 0/1 section below is the preserved checkpoint report. See the Phase 2 addendum for the current integrated lookup and deployed backend status.

## Scope and status

The approved first milestone is implemented and locally exercised: baseline investigation, source/provenance wording, strict EIN handling, source boundaries and regression coverage. The interface and repository documentation remain English-only. All 111 curated records and the original September 20, 2026 snapshot are preserved byte-for-byte. No dependency, account system, localization, payment feature, dashboard, dataset expansion or hosting migration was introduced.

At this Phase 0/1 checkpoint the work was local and uncommitted, with no deployment or push. The current backend deployment and later checks are recorded separately below.

## Routing and independent verification

- The development outline was previously assisted by Kimi K3 and revised to English by the coordinator before implementation was authorized.
- The initial coding route was verified as `deepseek-v4.1-flash` on `opencode-go`. One run was interrupted before edits; its retry exceeded the 600-second command limit and left a partial implementation. A timeout is not evidence that the provider is unavailable.
- The repair worker was verified as `kimi-k3`, using the configured Ark Kimi route (ledger billing provider `custom`, session `20261001_021530_d20863`). It finished and reported 43 passing tests, lint and build.
- The coordinator inspected the changes, reran those checks and added source-period handling, accurate metadata, timezone-stable snapshot dates and a route-state regression fix. Final checks below reflect this later code, not just the worker report.

## Changes

- `src/lib/status.ts`: accurate source labels, no unsupported Public Charity inference; distinct visitor/source EIN contracts; exact legacy-record resolution; finite financial amounts; safe HTTPS source-link handling; narrow upstream entry/list mapping; source-reported lookup periods or explicit unknowns.
- `src/lib/query.ts`: exact EIN matching rather than stripping arbitrary text into an identifier.
- `src/data/charities.ts`: curated-route resolution and an English snapshot date fixed to UTC.
- `src/components/LiveLookup.tsx`: invalid-EIN feedback before fetch; tested shared boundary helpers; truthful source/status wording; transfer and five-match limits disclosed at the form; absent lookup amounts explicitly labeled.
- `src/pages/Home.tsx`, `About.tsx`, `OrgDetail.tsx`, `src/App.tsx`, `index.html`: historical-source wording instead of certification; source and filing dates distinguished; safe source links retained.
- `OrgDetail.tsx`: lookup components keyed to the route parameter so a new organization route does not reuse a previous query/result state.
- `tests/ein.test.ts`, `boundary.test.ts`, `schema.test.ts`, `status.test.ts`: identifier, provenance, financial/source boundary and dataset-integrity regressions.
- `README.md`: project setup, source limitations, explicit refresh command and current scope replace the Vite template.

## Measured checks

Baseline coordinator execution:

- `npm ci` succeeded; the baseline audit reported zero vulnerabilities.
- `npm test`: 20 passed.
- `npm run lint` and `npm run build`: passed.

Final coordinator execution, Node.js 26.7.0 / npm 11.19.0:

- `npm test`: **44 passed, 0 failed**.
- `npm run lint`: passed.
- `npm run build`: passed (`tsc -b` and Vite production build).
- `git diff --check`: passed.
- `git diff --exit-code -- src/data/charities.json src/data/dataset-meta.json package.json package-lock.json`: passed; data and dependency manifests remain unchanged.
- Built-artifact Chromium verification: **1,800 assertions passed**, all 111 profiles exercised at 390px and 1440px widths. Checked actual record names/EINs, source links, snapshot/filing periods, financial amounts including missing versus zero, leading-zero searches/routes, malformed routes, validation feedback, rendered English content and horizontal overflow. No page errors or third-party requests occurred in these local/invalid-input flows.

The browser harness serves the **actual compiled production files through static browser-route interception**, not a listening server. It does not fabricate API responses or claim a production visit. Starting the Vite preview service was pending execution approval, so this alternative exercised the compiled artifact without starting a service. Screenshots are captures, not a subjective visual or full accessibility audit. Keyboard/screen-reader and valid upstream lookup lifecycle coverage remain further work.

The reproducible browser harness and its assertion report are included in `docs/verification/`; use the existing Playwright installation or supply `PLAYWRIGHT_REQUIRE_FROM` with the absolute path to a package.json whose project has Playwright installed. No Playwright dependency was added to this application's manifest.

### Red/green observations

- A new financial-period regression first failed because the mapper returned no `taxPeriod`; after implementing validated source-period mapping it passed with the full suite.
- The first browser pass failed after navigating from an invalid route/query to a valid but uncurated EIN: the heading updated, but the input still contained `000000000` instead of `99-9999999`. A fresh mount showed the correct value, isolating preserved component state rather than malformed route data. Keying the lookup by route parameter made the same transition pass in both viewports. The broad browser pass was rerun after this repair; it was not reported as passing while this failure remained.

## Actual upstream and deployment observations

Coordinator network requests, kept separate from controlled tests:

- ProPublica organization endpoint for EIN `530196605`: HTTP 200 with JSON. Sending an Origin header did not produce an `Access-Control-Allow-Origin` header. Organization update dates and historical filing periods are distinct fields. This is not a successful browser-CORS or production-app lookup test.
- Search `Red Cross`, pages 0 and 1: actual responses reported 190 results, 8 pages, 25 per page, zero-indexed pages 0/1, offsets 0/25, with 25 organizations returned on each. Documentation agrees that search is paginated.
- `https://leixue.dev/charitycheck/index.html`: the attempted browser visit failed with `ERR_NAME_NOT_RESOLVED`. The host resolver and a Cloudflare DNS-over-HTTPS query found no A address for `leixue.dev` at that check. This is an observed blocker, not a claim that every possible deployment is unavailable. DNS/hosting was not changed.

## Remaining Phase 2 scope

1. A coherent optional broader search from local no-match states.
2. Upstream pagination or explicit supported source limits beyond the currently disclosed five first-page matches.
3. Cancellation, stale-response protection and one overall deadline. A route key fixes local state reuse, not all in-flight request races.
4. Full response/error contract validation and mapping organization-response filing arrays to appropriately dated financial figures. Current boundary mapping is deliberately narrow; missing fields are not synthesized.
5. Verify browser CORS and real AllOrigins behavior; if a proxy remains necessary, propose a bounded first-party proxy with a fixed upstream before implementing infrastructure.
6. Verify the actual deployment target and live site before claiming publication or changing portfolio links.

Refreshes and hosting changes require their own scope decision. Do not equate historical records, source-reported subsection labels, passing tests or a new fetch timestamp with current IRS eligibility or organizational trustworthiness.

## Phase 2 addendum: integrated lookup and first-party Worker

### Implemented and integrated

- Broader lookup reuses the existing Browse name/EIN field through an explicit action. Local filtering never automatically transfers the query. State/cause/revenue filters do not apply upstream.
- `src/lib/lookup.ts` validates the source envelope, result identifiers and pagination, keeps every record on each source page, distinguishes source failures from genuine no-match responses, and matches requested EIN identity. For organization responses it selects the latest valid extracted filing while retaining the organization identity and source-reported classification.
- The lookup component adds cancellation, request-token stale-response protection, retry, and one 12-second deadline. Query changes and route changes cannot retain an earlier response as the current result.
- Name searches show source page counts and totals; a 10,000-result source cap is explicitly disclosed rather than claimed as nationwide completeness.
- `workers/lookup/worker.ts` and `wrangler.jsonc` define the deployed backend. It accepts only fixed ProPublica name/EIN requests, restricts origins/methods/query length/page range, limits upstream responses to 2 MB, applies an 8-second upstream timeout and disallows redirect following. It is not an arbitrary-URL proxy. Observability remains disabled.
- AllOrigins is removed from application request paths and point-of-action copy. Queries now pass through the project's Cloudflare Worker to ProPublica.
- Phase 2 was developed in an isolated worktree to avoid concurrent edits, then integrated into the original working copy. Later Phase 1 route-key and snapshot-date fixes were preserved. The snapshot and dependency manifests remain unchanged.

### Authorization and deployment

The user authorized a first-party Worker without changing the frontend URL or enabling a paid service, then explicitly corrected an earlier hold response to confirm option 1 (Workers Free/deploy). The existing OAuth login can deploy scripts but could not read billing subscriptions (HTTP 403); the free-plan confirmation came from the user, not independent billing inspection. No billing/subscription/plan-change command was executed.

Backend: `https://charitycheck-lookup.leixuework.workers.dev`

Verified deployed version: `87bd24de-eda4-41b2-81d5-6047348fd4a6`.

The first deployment's health/security checks passed but real queries returned 502. A bounded diagnostic exposed the cause: Cloudflare's fetch implementation does not support `redirect: 'error'`. Using `manual` with a non-2xx status check preserves the fixed-destination restriction and works at the edge. The diagnostic was removed, the Worker redeployed, and real readback verified HTTP 200 for both name-search pages and the leading-zero EIN lookup. The initial failure is not hidden or counted as a successful lookup.

### Final measured checks on the integrated tree

- `npm test`: **58 passed, 0 failed**.
- `npm run lint`: passed without warnings.
- `npm run build`: TypeScript/Vite production build passed.
- `git diff --check`: passed.
- Snapshot and package manifests: `git diff --exit-code -- src/data/charities.json src/data/dataset-meta.json package.json package-lock.json` passed.
- Controlled Chromium checks against the integrated production preview: source pages with 25 and 1 records, explicit-only transfer, one Browse query field, stale-response protection, invalid-input no-request, error/retry, the actual 12-second deadline, cancel and overflow checks at 390px/1280px all passed. No page errors. These used explicitly controlled fixtures, not real source claims.
- Separate real Chromium execution against the same integrated frontend and deployed Worker, with **no API mocks**: `Red Cross` reported 190 matches and eight pages, with 25 records displayed on each of pages one and two; `04-2263040` returned one matching record. Three Worker requests, zero AllOrigins requests, zero page errors. Tested mobile result state without horizontal page overflow.
- Worker readback: `/health` HTTP 200; unapproved origin HTTP 403; arbitrary `url` parameter HTTP 400; valid queries HTTP 200 with exact-origin CORS. The deployment command itself was not treated as acceptance.

### Remaining acceptance gates at the Phase 2 checkpoint

At the Phase 2 checkpoint, the backend was deployed and the main frontend was built and locally verified but **not published or verified on its production URL**. No frontend URL/DNS/hosting change, Git commit or push had been performed. At that point, automated accessibility and manual screen-reader acceptance remained outstanding. The later Phase 3 addendum below records the current local accessibility pass; publication/readback and human screen-reader acceptance remain open. Any new frontend origin requires an explicit Worker allowlist update and live CORS/browser verification.

## Phase 3 addendum: local accessibility pass (not published)

The next acceptance pass found and corrected low-contrast secondary text and a skipped heading level in Browse charity cards. It also added an automatically injected build timestamp and short commit SHA to the persistent footer so the live Pages build can be matched to its source commit. No dataset or runtime dependency was changed.

- `npm test`: **74 passed, 0 failed**; `npm run lint`, `npm run build` and `git diff --check` passed.
- The footer build marker includes the UTC build minute and an 8-character identifier sourced from `CF_PAGES_COMMIT_SHA`/`GITHUB_SHA` or the local Git HEAD; no package release version is fabricated.
- Production-build Chromium + axe-core audit: **128 scans, 111 organization records, 0 violations, 0 page errors**. Checked Home, populated and empty Browse, About, a sample detail at 320/390/1024/1440px, plus all 111 detail routes at 390px. WCAG 2.0/2.1/2.2 A/AA and best-practice tags were enabled.
- axe reports 4 incomplete contrast checks, all for Home text over the hero gradient (axe cannot determine gradient contrast). The actual configured gradient stops were separately measured: white text minimum 9.84:1 and brand-100 text minimum 7.76:1, both above 4.5:1.
- Keyboard smoke check verified initial focus, keyboard navigation into Browse, announcement of the no-results state, and recovery to all 111 records using Clear filters. This is not a screen-reader test.
- Reproducible harness: `docs/verification/verify-accessibility.mjs`; report: `docs/verification/accessibility-verification.json`. It reuses externally installed Playwright/axe via `PLAYWRIGHT_REQUIRE_FROM` and adds no app dependency.
- **Still outstanding:** manual screen-reader acceptance and publication/readback of these local changes. Do not describe the production website as fixed until the build has been deployed and checked live.
