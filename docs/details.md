# CharityCheck: details

## Data

- `src/data/charities.json`: the 500-organization snapshot (generated October 1, 2026).
- Source: [ProPublica Nonprofit Explorer API v2](https://projects.propublica.org/nonprofits/api).
- A snapshot is not a live IRS check. Verify current tax-exempt status with the [IRS Tax Exempt Organization Search](https://apps.irs.gov/app/eos/).

## Refresh the snapshot

```bash
npm run data:fetch                     # contacts ProPublica and rewrites the snapshot
npm run data:fetch -- --retry-misses   # retry only entries with no previous match
```

Review the changes (record count, amounts, dates, links) before committing.

## Live lookup backend

The optional live search runs through a small Cloudflare Worker in `workers/lookup/`. It only allows fixed ProPublica queries from the site's own origin.

```bash
npx wrangler deploy --config workers/lookup/wrangler.jsonc
```

If the site moves to a new domain, add it to the Worker's allowed origins.

## Privacy

Local search terms appear in the page URL, so don't enter sensitive personal information.
