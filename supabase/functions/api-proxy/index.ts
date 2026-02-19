// supabase/functions/api-proxy/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CACHE = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const target = url.searchParams.get('url')
  const source = url.searchParams.get('source')

  if (!target || !source) {
    return new Response(JSON.stringify({ error: 'Missing url or source param' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const cacheKey = `${source}:${target}`
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    })
  }

  try {
    const allowedDomains = [
      'api.jamendo.com',
      'jiosaavn-api-privatecvc2.vercel.app',
      'inv.nadeko.net',
      'invidious.nerdvpn.de',
    ]
    const targetUrl = new URL(target)
    const allowed = allowedDomains.some(d => targetUrl.hostname.endsWith(d))
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Syncy/1.0',
        Accept: 'application/json',
      },
    })

    const data = await res.json()
    CACHE.set(cacheKey, { data, ts: Date.now() })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
