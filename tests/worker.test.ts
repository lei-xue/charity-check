import assert from 'node:assert/strict'
import {test} from 'node:test'
import worker,{handleRequest} from '../workers/lookup/worker.ts'
const origin='https://leixue.dev'
const request=(path:string,method='GET',from=origin)=>new Request(`https://lookup.example${path}`,{method,headers:{Origin:from}})

test('worker rejects open-proxy input, unsupported methods and disallowed origins before fetch',async()=>{
 let calls=0
 const fetcher=(async()=>{calls++;return new Response('{}')}) as typeof fetch
 for(const [req,status] of [
  [request('/lookup?q=Foundation&url=https://evil.example'),400],
  [request('/lookup?q=000000000'),400],
  [request('/lookup?q=1.2e8'),400],
  [request('/lookup?q=Foundation&page=400'),400],
  [request('/lookup?q=Foundation&q=Other'),400],
  [request('/lookup?q=Foundation','POST'),405],
  [request('/lookup?q=Foundation','GET','https://evil.example'),403],
 ] as const) assert.equal((await handleRequest(req,fetcher)).status,status)
 assert.equal(calls,0)
})

test('worker forwards only fixed ProPublica targets and returns exact-origin CORS',async()=>{
 let target=''
 const response=await handleRequest(request('/lookup?q=04-2263040'),(async (url,init)=>{assert.equal(init?.redirect,'manual');target=String(url);return new Response(JSON.stringify({organization:{ein:42263040}}))}) as typeof fetch)
 assert.equal(target,'https://projects.propublica.org/nonprofits/api/v2/organizations/042263040.json')
 assert.equal(response.status,200)
 assert.equal(response.headers.get('access-control-allow-origin'),origin)
 assert.deepEqual(await response.json(),{organization:{ein:42263040}})
})

test('worker preflight succeeds with an empty body',async()=>{
 const response=await handleRequest(request('/lookup','OPTIONS'))
 assert.equal(response.status,204)
 assert.equal(await response.text(),'')
 assert.equal(response.headers.get('access-control-allow-methods'),'GET, OPTIONS')
})

test('worker rejects oversized and invalid upstream responses',async()=>{
 for(const mock of [new Response('{}',{headers:{'content-length':'3000000'}}),new Response('not JSON'),new Response('',{status:503})]) {
  assert.equal((await handleRequest(request('/lookup?q=Foundation'),(async()=>mock) as typeof fetch)).status,502)
 }
})

test('worker entrypoint accepts Cloudflare environment without treating it as a fetcher',async()=>{
 assert.equal((await worker.fetch(request('/health'))).status,200)
})
