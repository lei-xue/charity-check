// Run against a compiled local preview on an origin allowed by the lookup Worker.
// PREVIEW_URL=http://127.0.0.1:4188/ PLAYWRIGHT_MODULE_PATH=/path/to/playwright node scripts/lookup-cache-regression.mjs
// Synthetic failure/race/TTL checks are separate from real, unmocked Worker checks.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const base=(process.env.PREVIEW_URL || 'http://127.0.0.1:4188/').replace(/\/?$/, '/')
const version=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version
const api='https://charitycheck-lookup.leixuework.workers.dev/lookup'
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
const browser=await chromium.launch()
const evidence={target:base,synthetic:{},realBackend:{},geometry:[]}
try {
  const page=await browser.newPage()
  await page.addInitScript(()=>{window.__lookupTestClock=Date.now();Date.now=()=>window.__lookupTestClock})
  const requests=[]
  let failNext=false, holdSlow=true, releaseSlow
  await page.route(api+'**',async route=>{
    const u=new URL(route.request().url()), p=Number(u.searchParams.get('page')), query=u.searchParams.get('q')
    requests.push({query,page:p})
    if(query==='Slow fixture' && holdSlow) await new Promise(resolve=>{releaseSlow=resolve})
    if(failNext){failNext=false;return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'{}'})}
    const empty=query==='Empty fixture'
    const body=empty?{organizations:[],total_results:0,num_pages:0,cur_page:0,per_page:25}:{organizations:[{ein:100000001+p,name:query==='Slow fixture'?'SYNTHETIC obsolete charity':`SYNTHETIC charity ${p}`}],total_results:3,num_pages:3,cur_page:p,per_page:1}
    try {await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(body)})} catch { /* A deliberately cancelled held response cannot be delivered. */ }
  })
  await page.goto(base+'#/browse?q=Cache%20fixture')
  await page.getByRole('heading',{name:'Browse charities',exact:true}).waitFor()
  const submit=()=>page.getByRole('button',{name:'Look up this name or EIN',exact:true})
  const row=p=>page.getByText(`SYNTHETIC charity ${p}`,{exact:true})
  const section=page.locator('section[aria-labelledby="live-lookup-heading"]')
  const setQuery=async query=>{await page.getByLabel('Search',{exact:true}).fill(query);await frame(page)}
  await submit().click();await row(0).waitFor()
  const first=requests.length, originalTime=await section.locator('time').getAttribute('datetime')
  await submit().click();await row(0).waitFor();await frame(page)
  assert.equal(requests.length-first,0);evidence.synthetic.repeatRequests=0
  await page.getByRole('button',{name:'Next source page',exact:true}).click();await row(1).waitFor()
  const both=requests.length
  await page.getByRole('button',{name:'Previous source page',exact:true}).click();await row(0).waitFor()
  assert.equal(await section.locator('time').getAttribute('datetime'),originalTime)
  await page.getByRole('button',{name:'Next source page',exact:true}).click();await row(1).waitFor();await frame(page)
  assert.equal(requests.length-both,0);evidence.synthetic.pageRevisitRequests=0
  const time=await section.locator('time').getAttribute('datetime'), before=requests.length
  failNext=true;await page.getByRole('button',{name:'Refresh lookup',exact:true}).click();await section.getByRole('alert').waitFor()
  assert.equal(requests.length-before,1);assert.equal(await row(1).count(),1)
  assert.equal(await section.locator('time').getAttribute('datetime'),time);assert.match(await section.innerText(),/Stale/)
  await page.getByRole('button',{name:'Retry lookup',exact:true}).click();await section.getByRole('alert').waitFor({state:'hidden'});await row(1).waitFor()
  assert.equal(requests.at(-1).page,1);evidence.synthetic.failedRefreshRetainsRowsAndTime=true
  failNext=true;await page.getByRole('button',{name:'Next source page',exact:true}).click();await section.getByRole('alert').waitFor()
  assert.equal(await row(1).count(),0)
  await page.getByRole('button',{name:'Retry lookup',exact:true}).click();await row(2).waitFor();await section.getByRole('alert').waitFor({state:'hidden'})
  assert.equal(requests.at(-1).page,2);evidence.synthetic.retryPreservesFailedPage=true
  for(const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});await frame(page)
    const geo=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,refreshHeight:[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Refresh lookup').getBoundingClientRect().height}))
    assert.ok(geo.scroll<=geo.width);assert.ok(geo.refreshHeight>=44);evidence.geometry.push(geo)
  }
  // Age a cached source page without a real 15-minute wait, then fail its refresh.
  const expiryBefore=requests.length
  await page.evaluate(()=>{window.__lookupTestClock+=15*60*1000})
  failNext=true;await submit().click();await section.getByRole('alert').waitFor()
  assert.equal(requests.length-expiryBefore,1);assert.equal(await row(0).count(),1)
  assert.equal(await section.locator('time').getAttribute('datetime'),originalTime);assert.match(await section.innerText(),/Stale/)
  evidence.synthetic.expiryRetainsOriginalTime=true
  // A cancelled old query cannot replace the new query or populate its own cache.
  await setQuery('Slow fixture')
  const slowRequest=page.waitForRequest(r=>r.url().startsWith(api)&&new URL(r.url()).searchParams.get('q')==='Slow fixture')
  await submit().click();await slowRequest
  await setQuery('New fixture');await submit().click();await row(0).waitFor()
  holdSlow=false;releaseSlow();await frame(page)
  assert.equal(await page.getByText('SYNTHETIC obsolete charity',{exact:true}).count(),0)
  const slowBefore=requests.length
  await setQuery('Slow fixture');await submit().click();await page.getByText('SYNTHETIC obsolete charity',{exact:true}).waitFor()
  assert.equal(requests.length-slowBefore,1);evidence.synthetic.obsoleteResponseNotPublishedOrCached=true
  await setQuery('Empty fixture');await submit().click();await section.getByText(/No match found for that search/).waitFor()
  const emptyBefore=requests.length
  await submit().click();await section.getByText(/No match found for that search/).waitFor();await frame(page)
  assert.equal(requests.length-emptyBefore,0)
  failNext=true;await page.getByRole('button',{name:'Refresh lookup',exact:true}).click();await section.getByRole('alert').waitFor()
  assert.equal(await section.getByText(/No match found for that search/).count(),0);assert.match(await section.innerText(),/Stale/)
  evidence.synthetic.cachedEmptyDistinctFromError=true
  const invalidBefore=requests.length
  await setQuery('530196605.0');await submit().click();await section.getByRole('alert').waitFor()
  assert.match(await section.innerText(),/Nothing was sent/);await frame(page);assert.equal(requests.length,invalidBefore)
  evidence.synthetic.invalidInputNoRequest=true
  const storage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))
  assert.equal(storage.local.length,0);assert.equal(storage.session.length,0);evidence.synthetic.storage=storage
  await page.close()
  // This page does not mock or rewrite the real first-party lookup endpoint.
  const real=await browser.newPage(), calls=[]
  real.on('request',r=>{if(r.url().startsWith(api))calls.push(Number(new URL(r.url()).searchParams.get('page')))})
  await real.goto(base+'#/browse?q=Foundation');await real.getByRole('heading',{name:'Browse charities',exact:true}).waitFor()
  assert.equal(calls.length,0)
  const realSection=real.locator('section[aria-labelledby="live-lookup-heading"]'), realSubmit=real.getByRole('button',{name:'Look up this name or EIN',exact:true})
  const response=real.waitForResponse(r=>r.url().startsWith(api))
  await realSubmit.click();const source=await response;assert.equal(source.status(),200)
  evidence.realBackend.cacheControl=source.headers()['cache-control'];assert.match(evidence.realBackend.cacheControl,/no-store/)
  const body=await source.json();evidence.realBackend.sourceReportedTotal=body.total_results
  await realSection.getByText(/Source page 1 of/).waitFor();await realSection.locator('time').waitFor()
  const sourceTime=await realSection.locator('time').getAttribute('datetime'), initial=calls.length
  await realSubmit.click();await frame(real);assert.equal(calls.length-initial,0)
  assert.equal(await realSection.locator('time').getAttribute('datetime'),sourceTime);evidence.realBackend.repeatRequests=0
  await real.getByRole('button',{name:'Next source page',exact:true}).click();await realSection.getByText(/Source page 2 of/).waitFor()
  const pageCount=calls.length
  await real.getByRole('button',{name:'Previous source page',exact:true}).click();await realSection.getByText(/Source page 1 of/).waitFor()
  await real.getByRole('button',{name:'Next source page',exact:true}).click();await realSection.getByText(/Source page 2 of/).waitFor();await frame(real)
  assert.equal(calls.length-pageCount,0);evidence.realBackend.pageRevisitRequests=0
  const refreshResponse=real.waitForResponse(r=>r.url().startsWith(api))
  await real.getByRole('button',{name:'Refresh lookup',exact:true}).click();assert.equal((await refreshResponse).status(),200)
  await real.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Refresh lookup');return b&&!b.disabled})
  assert.equal(calls.length-pageCount,1);evidence.realBackend.forceRefreshRequests=1
  evidence.realBackend.pages=calls;evidence.realBackend.footer=await real.locator('footer').innerText()
  assert.ok(evidence.realBackend.footer.includes(`Version ${version}`))
  assert.match(await realSection.innerText(),/Neither a fresh nor cached response is current IRS verification/i)
  await real.close()
  if(process.env.BROWSER_OUTPUT_FILE) fs.writeFileSync(process.env.BROWSER_OUTPUT_FILE,JSON.stringify(evidence,null,2))
  console.log(JSON.stringify(evidence,null,2))
} finally {await browser.close()}
