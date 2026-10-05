import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createLookupCache} from '../src/lib/lookupCache.ts'

const payload = (page=0) => ({organizations:[{ein:100000001+page,name:`SYNTHETIC cache fixture ${page}`}],total_results:2,num_pages:2,cur_page:page,per_page:1})
const response = (body:unknown) => new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}})
const signal = () => new AbortController().signal
function fixture() {
  let calls=0, clock=1700000000000
  const fetcher=(async (target:unknown) => {calls++;return response(payload(Number(new URL(String(target)).searchParams.get('page'))))}) as typeof fetch
  const cache=createLookupCache({fetcher,now:()=>clock})
  return {cache,calls:()=>calls,advance:(ms:number)=>{clock+=ms}}
}

test('fresh repeated submission and page revisit add no requests and preserve fetched time',async()=>{
  const f=fixture();const first=await f.cache.load('Fixture',0,signal());
  f.advance(1000);await f.cache.load('Fixture',1,signal());
  const revisit=await f.cache.load('Fixture',0,signal());await f.cache.load('Fixture',1,signal());
  assert.equal(f.calls(),2);assert.equal(revisit.fetchedAt,first.fetchedAt);assert.equal(revisit.stale,false)
})
test('force bypass reaches backend but normal revisit returns the successful replacement',async()=>{
  const f=fixture();const first=await f.cache.load('Fixture',0,signal());f.advance(1)
  const refreshed=await f.cache.load('Fixture',0,signal(),true);await f.cache.load('Fixture',0,signal())
  assert.equal(f.calls(),2);assert.ok(refreshed.fetchedAt>first.fetchedAt)
})
test('15-minute boundary and backward clock are stale without deleting fallback',async()=>{
  const f=fixture();await f.cache.load('Fixture',0,signal());f.advance(15*60*1000-1)
  assert.equal(f.cache.read('Fixture',0)?.stale,false);f.advance(1)
  assert.equal(f.cache.read('Fixture',0)?.stale,true);await f.cache.load('Fixture',0,signal());assert.equal(f.calls(),2)
  f.advance(-1);assert.equal(f.cache.read('Fixture',0)?.stale,true)
})
test('cache key retains literal name case and interior spacing but matches submitted outer trim',async()=>{
  const f=fixture();for(const q of ['Fixture name','fixture name','Fixture  name']) await f.cache.load(q,0,signal())
  await f.cache.load('  Fixture name  ',0,signal());assert.equal(f.calls(),3)
})
test('invalid identifiers and pages are rejected before any cached or network result',async()=>{
  const f=fixture();for(const q of ['', '000000000','530196605.0','x'.repeat(201)]) {
    assert.throws(()=>f.cache.read(q,0));await assert.rejects(f.cache.load(q,0,signal()))
  }
  for(const page of [-1,400,1.5]) await assert.rejects(f.cache.load('Fixture',page,signal()))
  assert.equal(f.calls(),0)
})
test('valid leading-zero EIN remains exact and malformed alternatives cannot borrow it',async()=>{
  let calls=0;const cache=createLookupCache({fetcher:(async()=>{calls++;return response({organization:{ein:42263040,name:'SYNTHETIC leading-zero fixture'}})}) as typeof fetch})
  await cache.load('04-2263040',0,signal());await cache.load('04-2263040',0,signal());
  assert.equal(calls,1);await assert.rejects(cache.load('42263040',0,signal()));assert.equal(calls,1)
})
test('HTTP failures never become cached empty successes and preserve prior valid fallback',async()=>{
  let fail=false,calls=0;const cache=createLookupCache({fetcher:(async()=>{calls++;return fail?new Response('',{status:503}):response(payload())}) as typeof fetch})
  const first=await cache.load('Fixture',0,signal());fail=true
  await assert.rejects(cache.load('Fixture',0,signal(),true));assert.deepEqual(cache.read('Fixture',0)?.data,first.data)
  await assert.rejects(cache.load('Other',0,signal()));assert.equal(cache.read('Other',0),null);assert.equal(calls,3)
})
test('malformed partial source pages do not enter the cache',async()=>{
  const cache=createLookupCache({fetcher:(async()=>response({...payload(),organizations:[{ein:'invalid'}]})) as typeof fetch})
  await assert.rejects(cache.load('Fixture',0,signal()));assert.equal(cache.read('Fixture',0),null)
})
test('genuine successful empty responses reuse zero-result metadata',async()=>{
  let calls=0;const cache=createLookupCache({fetcher:(async()=>{calls++;return response({organizations:[],total_results:0,num_pages:0,cur_page:0,per_page:25})}) as typeof fetch})
  const empty=await cache.load('Fixture',0,signal());assert.equal(empty.data.total,0)
  await cache.load('Fixture',0,signal());assert.equal(calls,1)
})
test('already aborted signals reject even fresh cache hits',async()=>{
  const f=fixture();await f.cache.load('Fixture',0,signal());const controller=new AbortController();controller.abort()
  await assert.rejects(f.cache.load('Fixture',0,controller.signal));assert.equal(f.calls(),1)
})
test('a late source result after cancellation is not cached',async()=>{
  const controller=new AbortController()
  const cache=createLookupCache({fetcher:(async()=>{controller.abort();return response(payload())}) as typeof fetch})
  await assert.rejects(cache.load('Fixture',0,controller.signal));assert.equal(cache.read('Fixture',0),null)
})
test('40-entry LRU eviction and explicit clear bound retained snapshots',async()=>{
  const f=fixture();for(let i=0;i<40;i++) await f.cache.load(`Fixture ${i}`,0,signal())
  f.cache.read('Fixture 0',0);await f.cache.load('Fixture 40',0,signal())
  assert.ok(f.cache.read('Fixture 0',0));assert.equal(f.cache.read('Fixture 1',0),null)
  f.cache.clear();assert.equal(f.cache.read('Fixture 0',0),null)
})
