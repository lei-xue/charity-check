const ALLOWED_ORIGINS = new Set(['https://leixue.dev', 'https://charitycheck.leixue.dev', 'https://charity-check.pages.dev', 'http://127.0.0.1:4188', 'http://localhost:5173'])
const UPSTREAM = 'https://projects.propublica.org/nonprofits/api/v2'
const MAX_BYTES = 2_000_000

function json(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string,string> = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin']=origin
    headers['Vary']='Origin'
  }
  return new Response(JSON.stringify(body),{status,headers})
}

export async function handleRequest(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin=request.headers.get('Origin')
  const url=new URL(request.url)
  if(url.pathname==='/health' && request.method==='GET') return json({service:'charitycheck-lookup',status:'ok'},200,origin)
  if(!origin || !ALLOWED_ORIGINS.has(origin)) return json({error:'Origin not allowed'},403,null)
  if(request.method==='OPTIONS') {
    const response=json(null,200,origin)
    // A 204 cannot have a body; construct only headers.
    return new Response(null,{status:204,headers:{...Object.fromEntries(response.headers),'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Accept','Access-Control-Max-Age':'600'}})
  }
  if(request.method!=='GET') return json({error:'Only GET is supported'},405,origin)
  if(url.pathname!=='/lookup') return json({error:'Not found'},404,origin)
  if([...url.searchParams.keys()].some(k=>!['q','page'].includes(k)) || url.searchParams.getAll('q').length!==1 || url.searchParams.getAll('page').length>1) return json({error:'Unsupported parameters'},400,origin)
  const q=(url.searchParams.get('q')??'').trim()
  const page=url.searchParams.get('page')??'0'
  if(!q || q.length>200 || [...q].some(character => character.charCodeAt(0) < 32) || !/^(0|[1-9]\d{0,2})$/.test(page) || Number(page)>399) return json({error:'Invalid query or page'},400,origin)
  const ein=/^(\d{2})-?(\d{7})$/.exec(q)
  const numeric=/^[\d\s.+-]+$/.test(q) || /^[+-]?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(q) || /^0x[\da-f]+$/i.test(q)
  if((ein && `${ein[1]}${ein[2]}`==='000000000') || (!ein && numeric) || (ein && page!=='0')) return json({error:'Invalid EIN'},400,origin)
  const target=ein ? `${UPSTREAM}/organizations/${ein[1]}${ein[2]}.json` : `${UPSTREAM}/search.json?q=${encodeURIComponent(q)}&page=${page}`
  try {
    const upstream=await fetcher(target,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.any([request.signal,AbortSignal.timeout(8000)])})
    if(!upstream.ok) return json({error:'Upstream unavailable',upstreamStatus:upstream.status},502,origin)
    if(Number(upstream.headers.get('content-length'))>MAX_BYTES) return json({error:'Upstream response too large'},502,origin)
    if(!upstream.body) return json({error:'Missing upstream body'},502,origin)
    const reader=upstream.body.getReader()
    const chunks: Uint8Array[]=[]
    let bytes=0
    while(true) {
      const part=await reader.read()
      if(part.done) break
      bytes+=part.value.byteLength
      if(bytes>MAX_BYTES) {await reader.cancel(); return json({error:'Upstream response too large'},502,origin)}
      chunks.push(part.value)
    }
    const data=new Uint8Array(bytes)
    let offset=0
    for(const chunk of chunks) {data.set(chunk,offset);offset+=chunk.byteLength}
    const payload: unknown=JSON.parse(new TextDecoder().decode(data))
    if(!payload || typeof payload!=='object' || Array.isArray(payload)) return json({error:'Invalid upstream JSON'},502,origin)
    return json(payload,200,origin)
  } catch {
    return json({error:'Upstream request failed or timed out'},502,origin)
  }
}

export default {fetch(request: Request) {return handleRequest(request)}}
