import assert from 'node:assert/strict'
import {test} from 'node:test'
import {lookup, lookupUrl, parseLookupPage} from '../src/lib/lookup.ts'

const pagePayload = (page=0) => ({organizations:[{ein:530196605+page,name:`Controlled test ${page}`}],total_results:2,num_pages:2,cur_page:page,per_page:1})
const response = (value:unknown) => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}})

test('lookup target uses strict EIN input and bounded zero-based pages', () => {
  assert.ok(lookupUrl('04-2263040').endsWith('/organizations/042263040.json'))
  assert.ok(lookupUrl('3M Foundation',1).endsWith('q=3M%20Foundation&page=1'))
  for(const input of ['', '000000000','530196605.0','x'.repeat(201)]) assert.throws(()=>lookupUrl(input))
  for(const page of [-1,400,1.5]) assert.throws(()=>lookupUrl('Foundation',page))
})

test('every source page is preserved without five-result truncation', () => {
  const orgs = Array.from({length:25},(_,i)=>({ein:100000000+i,name:`Fixture ${i}`}))
  const first=parseLookupPage({organizations:orgs,total_results:26,num_pages:2,cur_page:0,per_page:25},'Foundation',0)
  const second=parseLookupPage({organizations:[{ein:100000025}],total_results:26,num_pages:2,cur_page:1,per_page:25},'Foundation',1)
  assert.equal(first.results.length,25)
  assert.equal(second.results.length,1)
  assert.equal(new Set([...first.results,...second.results].map(r=>r.ein)).size,26)
})

test('invalid payloads and pagination fail instead of reporting no matches', () => {
  for(const payload of [null, {}, {organizations:null}, {...pagePayload(),cur_page:1}, {...pagePayload(),total_results:'2'}, {...pagePayload(),organizations:[null]}, {...pagePayload(),organizations:[]}]) {
    assert.throws(()=>parseLookupPage(payload,'Foundation',0))
  }
  assert.throws(()=>parseLookupPage({organization:{ein:530196606}},'530196605',0))
})

test('empty search and source cap are distinct honest states', () => {
  assert.equal(parseLookupPage({organizations:[],total_results:0,num_pages:0,cur_page:0,per_page:25},'Foundation',0).total,0)
  assert.equal(parseLookupPage({organizations:[{ein:530196605}],total_results:10000,num_pages:400,cur_page:0,per_page:25},'Foundation',0).sourceLimit,true)
})

test('EIN detail uses the latest extracted historical filing without changing identity', () => {
  const page=parseLookupPage({organization:{ein:42263040,name:'Source name',subsection_code:3},filings_with_data:[{ein:123456789,tax_prd:202212,totrevenue:1},{ein:123456789,tax_prd:202312,totrevenue:0}]},'04-2263040',0)
  assert.equal(page.results[0].ein,42263040)
  assert.equal(page.results[0].name,'Source name')
  assert.equal(page.results[0].revenue,0)
  assert.equal(page.results[0].taxPeriod,202312)
})

test('lookup uses only the fixed first-party endpoint', async () => {
  const calls:string[]=[]
  const fetcher=(async (url:unknown) => {calls.push(String(url)); return response(pagePayload())}) as typeof fetch
  const result=await lookup('Foundation',0,new AbortController().signal,fetcher)
  assert.equal(result.results.length,1)
  assert.equal(calls.length,1)
  assert.equal(calls[0],'https://charitycheck-lookup.leixuework.workers.dev/lookup?q=Foundation&page=0')
})

test('cancellation prevents fallback and late success', async () => {
  const controller=new AbortController()
  let calls=0
  const fetcher=(async () => {calls++; controller.abort(); return response(pagePayload())}) as typeof fetch
  await assert.rejects(lookup('Foundation',0,controller.signal,fetcher))
  assert.equal(calls,1)
})

test('overall timeout aborts a hung request without another attempt', async () => {
  let calls=0
  const fetcher=((_url:unknown, init:RequestInit) => {calls++; return new Promise<Response>((_resolve,reject)=>{
    const signal=init.signal!
    const timer=setTimeout(()=>reject(new Error('Test safety timer')),200)
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason)},{once:true})
  })}) as typeof fetch
  await assert.rejects(lookup('Foundation',0,new AbortController().signal,fetcher,20), {name:'TimeoutError'})
  assert.equal(calls,1)
})

test('proxy HTTP errors do not become false no-match results', async () => {
  await assert.rejects(lookup('530196605',0,new AbortController().signal,(async()=>new Response('',{status:404})) as typeof fetch))
})
