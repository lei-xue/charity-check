# CharityCheck v0.0.2 — live lookup cache acceptance

## Approved gate and boundaries

Source baseline: `5222d2e3a0a86e3b6901144ba13d6a9065cc06c5`, matching fetched `origin/main` at discovery. This advances the CharityCheck P2 live-result/source-page reuse gate, not the remaining MindBridge work.

Kimi K3 supplied the read-only plan and implemented the cache/UI, including a narrow correction after independent browser failures. Session usage was checked for all planning, coding and copy runs: model `kimi-k3`, billed provider `custom`. The coordinator wrote regression tests, reviewed source and ran the integrated checks. The reviewer did not run a browser.

Keep the English-only interface and existing cream/burgundy design. The curated 500-record snapshot, local filters/pagination, source parser, strict EIN rules, 12-second deadline, Worker and HTTP/privacy policy are unchanged. No dependency versions were changed. Package version is now `0.0.2`; the build injects UTC build time and the commit SHA automatically.

## Implemented behavior

- `src/lib/lookupCache.ts`: an isolated factory and app singleton, bounded to 40 memory-only LRU entries; 15-minute freshness.
- Validate literal visitor EIN/name and source page before every key/read/load. Versioned keys use the fixed endpoint, exact submitted outer-trimmed query and zero-based source page. Case/interior whitespace and formatted identifiers are not silently rewritten or conflated.
- Store only successful pages returned by the existing validated source pipeline, including genuine empty responses. HTTP/source-validation failures are not cached.
- Fresh duplicate submissions/page revisits add no requests and retain their original retrieval timestamp. Expiry and clock rollback mark old entries stale without resetting their time.
- Refresh and Retry bypass fresh hits. Retry targets the **failed source page**, not page zero. A pending/failed refresh retains only a matching query/page's cached data, with truthful stale/error wording; a different uncached page cannot borrow the preceding page's rows.
- Abort checks before and after source resolution prevent obsolete cache writes; existing UI tokens prevent obsolete publication. Cancel/query changes invalidate the request.
- Empty success remains distinct from source failure. Failed refresh of cached empty data does not show the no-match guidance as a new successful source result.
- New retrieval-time/refresh/stale UI retains the explicit transfer disclosure and source-count/cap meanings. Neither fresh nor cached ProPublica data is current IRS verification, proof of current tax exemption, or a donation-eligibility guarantee.

Memory-only caching does not change existing hash-router query/history behavior: Browse queries already appear in URLs, and the README continues to disclose that. Do not enter sensitive personal information. No new localStorage, sessionStorage or IndexedDB cache is implemented. Reload clears the module cache. Expired fallback is retained only within the 40-entry bound; eviction removes it.

## Executed verification

- Clean `npm ci`; **101/101 Node TypeScript tests**, including **12 cache regressions**.
- `npm run lint`, `tsc -b`, optimized Vite build and `git diff --check`: passed.
- Red-capable production reproduction used the exact CharityCheck hostname: two explicit identical synthetic submissions added **1** repeat request before the fix. Synthetic records were not represented as real charity data.
- `scripts/lookup-cache-regression.mjs` against the compiled artifact: duplicate submission and page 0→1→0→1 revisits added **0** requests; force refresh added **1**. It also passed failed-refresh/time retention, retry of an uncached failed page, simulated TTL expiry, cancelled old-query non-publication/non-caching, cached-empty/error distinction and malformed-EIN **0-request** checks.
- Separate **unmocked deployed Worker** checks: HTTP **200**; repeat query and source-page revisits added **0** requests; explicit page refresh added **1**. The response retained **`Cache-Control: no-store`**. `Foundation` returned the source-reported **10,000-result cap**, not an assertion that all real-world organizations were enumerated.
- Local/session browser storage were empty after the synthetic flows. Lookup controls met **44px** height and had no horizontal overflow at **320, 390, 1440 CSS px**.
- Current `scripts/browse-focus-regression.mjs`: **10/10 checks passed**, including shareable local page URLs, keyboard focus, clear-filter restoration and typing causing **0 remote requests**.

Two failed probes were preserved rather than reported as passes: the first cache browser check failed because fresh-cache refresh failure lacked a stale label; independent source review also found the wrong-page pending/failure fallback. K3 corrected those defects and the same browser checks passed. An archived `docs/verification/verify-browser.mjs` also failed its pre-pagination expectation that all 500 records were rendered simultaneously (12 are intentionally visible per local page); the current pagination/focus harness was used and passed. The archived checkpoint script was not weakened or counted as a successful current check.

## Reproduce browser checks

Start a compiled preview at `http://127.0.0.1:4188/`, an already allowed Worker origin. Do not edit the Worker allowlist merely for a test. Install Playwright separately if needed, or point to an existing package directory:

```sh
PREVIEW_URL=http://127.0.0.1:4188/ \
PLAYWRIGHT_MODULE_PATH=/path/to/node_modules/playwright \
node scripts/lookup-cache-regression.mjs

PREVIEW_URL=http://127.0.0.1:4188/ \
PLAYWRIGHT_MODULE_PATH=/path/to/node_modules/playwright \
node scripts/browse-focus-regression.mjs
```

Optional `BROWSER_OUTPUT_FILE` saves the measured cache evidence. Automated network/DOM/geometry checks are not a manual screen-reader or subjective visual audit.

## Publication state

Per the standing instruction, commit and push the verified repair branch and read back the remote SHA before reporting delivery. Do not equate pushing that branch with merging into `main` or updating `https://charitycheck.leixue.dev/`. The final local artifact is rebuilt after the source commit so its footer identifies the actual release commit. No Worker deployment or explicit production deployment is part of this gate.
