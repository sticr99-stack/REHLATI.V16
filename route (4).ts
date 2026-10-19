/* رحلتي — إكمال تلقائي للمطارات/المدن */
import { NextRequest } from 'next/server'
import { ok, fail, clientIp } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { searchAirports } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limited = rateLimit(`air:${clientIp(req)}`, 60, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const q = req.nextUrl.searchParams.get('q') || ''
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ar'
  if (q.length > 60) return fail('query too long', 400)
  return ok({ airports: searchAirports(q, lang) })
}
