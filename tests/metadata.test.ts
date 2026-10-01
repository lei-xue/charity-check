import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')
const readBytes = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url))

const html = read('index.html')
const SITE = 'https://charitycheck.leixue.dev/'
const SOCIAL_IMAGE = 'https://charitycheck.leixue.dev/og-image.png'

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
    attributes[match[1].toLowerCase()] = match[2]
  }
  return attributes
}

const metaTags = (html.match(/<meta\b[^>]*>/gi) ?? []).map(parseAttributes)
const linkTags = (html.match(/<link\b[^>]*>/gi) ?? []).map(parseAttributes)

function metaByName(name: string): Record<string, string>[] {
  return metaTags.filter((tag) => tag.name === name)
}

function metaByProperty(property: string): Record<string, string>[] {
  return metaTags.filter((tag) => tag.property === property)
}

function metaContentBy(attr: 'name' | 'property', key: string): string | undefined {
  const found = metaTags.filter((tag) => tag[attr] === key)
  assert.equal(found.length, 1, `expected exactly one <meta ${attr}="${key}">, found ${found.length}`)
  return found[0].content
}

test('document declares exactly one title and it is descriptive and truthful', () => {
  const titles = html.match(/<title>([^<]*)<\/title>/gi) ?? []
  assert.equal(titles.length, 1, 'index.html must contain exactly one <title>')
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ''
  assert.ok(title.includes('CharityCheck'), 'title must name the product')
  assert.ok(title.length >= 20 && title.length <= 70, `title length should be 20-70 chars, got ${title.length}`)
  assert.ok(/nonprofit|charit/i.test(title), 'title must describe what the site covers')
  assert.ok(!/verify a charity|certif|rating/i.test(title), 'title must not claim verification, certification or a rating')
  assert.equal(metaByProperty('og:title').length, 1, 'og:title must appear exactly once')
  assert.equal(metaByName('twitter:title').length, 1, 'twitter:title must appear exactly once')
})

test('description is present, unique and does not claim certification', () => {
  const description = metaContentBy('name', 'description') ?? ''
  assert.ok(description.length >= 50, 'description must be descriptive')
  assert.ok(description.includes('111'), 'description should state the curated dataset size truthfully')
  assert.match(description, /Informational only/, 'description must disclose the informational-only limit')
  assert.ok(!/verify a charity|certif|trust rating\b/i.test(description.replace('not a trust rating', '').replace('not a confirmation', '')), 'description must not claim certification or a trust rating')
})

test('canonical and social URLs point at the production origin', () => {
  const canonical = linkTags.filter((tag) => tag.rel === 'canonical')
  assert.equal(canonical.length, 1, 'expected exactly one canonical link')
  assert.equal(canonical[0].href, SITE)
  assert.equal(metaContentBy('property', 'og:url'), SITE)
})

test('Open Graph metadata is complete, absolute and truthful', () => {
  assert.equal(metaContentBy('property', 'og:type'), 'website')
  assert.equal(metaContentBy('property', 'og:site_name'), 'CharityCheck')
  assert.equal(metaContentBy('property', 'og:locale'), 'en_US')
  assert.equal(metaContentBy('property', 'og:image'), SOCIAL_IMAGE)
  assert.ok(SOCIAL_IMAGE.startsWith('https://'), 'og:image must be an absolute HTTPS URL')
  assert.ok(SOCIAL_IMAGE.endsWith('.png'), 'og:image must be a PNG URL')
  assert.equal(metaContentBy('property', 'og:image:type'), 'image/png')
  assert.equal(metaContentBy('property', 'og:image:width'), '1200')
  assert.equal(metaContentBy('property', 'og:image:height'), '630')
  const alt = metaContentBy('property', 'og:image:alt') ?? ''
  assert.ok(alt.length >= 20, 'og:image:alt must describe the image')
  assert.ok(!/shield|check mark|certif/i.test(alt), 'alt text must not imply certification imagery')
})

test('Twitter card metadata mirrors Open Graph and is complete', () => {
  assert.equal(metaContentBy('name', 'twitter:card'), 'summary_large_image')
  assert.equal(metaContentBy('name', 'twitter:title'), metaContentBy('property', 'og:title'))
  assert.equal(metaContentBy('name', 'twitter:description'), metaContentBy('property', 'og:description'))
  assert.equal(metaContentBy('name', 'twitter:image'), SOCIAL_IMAGE)
  assert.equal(metaContentBy('name', 'twitter:image:alt'), metaContentBy('property', 'og:image:alt'))
})

test('theme colour and icon are declared once', () => {
  assert.equal(metaContentBy('name', 'theme-color'), '#922c4e')
  assert.equal(metaContentBy('name', 'viewport'), 'width=device-width, initial-scale=1.0')
  const icons = linkTags.filter((tag) => tag.rel === 'icon')
  assert.equal(icons.length, 1, 'expected exactly one icon link')
  assert.equal(icons[0].type, 'image/svg+xml')
  assert.equal(icons[0].href, '/favicon.svg')
})

test('no search actions or rating structured data are declared', () => {
  assert.ok(!/SearchAction|potentialAction/i.test(html), 'no search-action structured data')
  assert.ok(!/aggregateRating|ratingValue|Review\b/i.test(html), 'no rating or review structured data')
})

test('optional WebSite JSON-LD is valid, minimal and truthful', () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
  assert.equal(blocks.length, 1, 'expected at most one JSON-LD block')
  const data = JSON.parse(blocks[0][1])
  assert.equal(data['@type'], 'WebSite')
  assert.equal(data.url, SITE)
  assert.equal(data.name, 'CharityCheck')
  assert.equal(data.inLanguage, 'en')
  assert.ok(!('potentialAction' in data), 'WebSite JSON-LD must not declare a search action')
  assert.ok(!('aggregateRating' in data), 'WebSite JSON-LD must not declare a rating')
})

test('robots.txt allows crawling and points at the sitemap', () => {
  const robots = read('public/robots.txt')
  assert.match(robots, /^User-agent: \*$/m)
  assert.match(robots, /^Allow: \/$/m)
  assert.match(robots, /^Sitemap: https:\/\/charitycheck\.leixue\.dev\/sitemap\.xml$/m)
  assert.ok(!robots.includes('/#'), 'robots.txt must not reference hash routes')
})

test('sitemap lists the homepage only and never a hash route', () => {
  const sitemap = read('public/sitemap.xml')
  const locations = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(locations, [SITE])
  assert.ok(!sitemap.includes('#'), 'a hash-router app must not put fragment routes in the sitemap')
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/)
})

test('the social card is an original 1200x630 PNG', () => {
  const png = readBytes('public/og-image.png')
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'og-image.png must be a real PNG')
  assert.equal(png.readUInt32BE(16), 1200, 'og-image.png width must match the declared 1200')
  assert.equal(png.readUInt32BE(20), 630, 'og-image.png height must match the declared 630')
  assert.ok(png.length > 10_000, 'og-image.png must contain a rendered card, not a stub')
})

test('favicon replaces the template artwork with the burgundy brand mark', () => {
  const favicon = read('public/favicon.svg')
  assert.ok(favicon.includes('viewBox="0 0 48 48"'), 'favicon must use the project viewBox')
  assert.ok(favicon.includes('#922c4e'), 'favicon must use the burgundy brand colour')
  assert.ok(favicon.includes('<circle'), 'favicon must contain the magnifier lens')
  assert.ok(!favicon.includes('863bff'), 'favicon must not be the Vite template logo')
  assert.ok(!/shield/i.test(favicon), 'the brand mark must not use shield imagery')
  assert.ok(!/<polyline/i.test(favicon), 'the brand mark must not use check-mark imagery')
})

test('the rendered brand mark matches the favicon and avoids certification imagery', () => {
  const brand = read('src/components/BrandMark.tsx')
  // Static markup only: the source comment deliberately names the imagery it avoids.
  const markup = brand.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? ''
  assert.ok(markup.length > 0, 'the brand component must render an inline <svg>')
  assert.ok(markup.includes('#922c4e'), 'the header mark must use the burgundy brand colour')
  assert.ok(markup.includes('aria-hidden="true"'), 'the decorative header mark must stay out of the accessibility tree')
  assert.ok(!/shield/i.test(markup), 'the brand mark must not use shield imagery')
  assert.ok(!/<polyline/i.test(markup), 'the brand mark must not use check-mark imagery')
  for (const snippet of ['<rect', '<circle', '<path']) {
    assert.ok(markup.includes(snippet), `the brand mark must draw a document and magnifier (${snippet})`)
  }
})

test('secondary text colour meets WCAG AA contrast on white and cream surfaces', () => {
  const css = read('src/index.css')
  const foreground = css.match(/--color-slate-500:\s*(#[\da-f]{6})/i)?.[1]
  assert.ok(foreground, 'the secondary text colour must be explicitly set')
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? []
    const [r, g, b] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  for (const background of ['#ffffff', '#faf7f0']) {
    const ratio = (luminance(background) + 0.05) / (luminance(foreground) + 0.05)
    assert.ok(ratio >= 4.5, `${foreground} on ${background} must reach 4.5:1, got ${ratio.toFixed(2)}:1`)
  }
  const orgDetail = read('src/pages/OrgDetail.tsx')
  assert.match(orgDetail, /Not reported[\s\S]{0,100}text-slate-500|text-slate-500[\s\S]{0,100}Not reported/)
  const charityCard = read('src/components/CharityCard.tsx')
  assert.ok(charityCard.includes('<h2 className="font-semibold leading-snug text-slate-900">{org.name}</h2>'))
  assert.ok(!charityCard.includes('<h3'), 'browse cards must not skip a heading level after the page h1')
})

test('site footer exposes a build timestamp and short commit identifier', () => {
  const app = read('src/App.tsx')
  const config = read('vite.config.ts')
  assert.ok(app.includes('Version: {__APP_BUILD_VERSION__}'))
  assert.ok(config.includes('CF_PAGES_COMMIT_SHA'))
  assert.ok(config.includes("execFileSync('git', ['rev-parse', 'HEAD']"))
})
