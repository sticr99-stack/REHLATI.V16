/* رحلتي — بحث الباقات (طيران + فندق مجمعين) */
import { NextRequest } from 'next/server'
import { ok, fail, clientIp } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { searchPackages } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limited = rateLimit(`pkg:${clientIp(req)}`, 30, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const sp = req.nextUrl.searchParams
  const pax = Math.min(9, Math.max(1, parseInt(sp.get('pax') || '2', 10) || 2))
  const nights = Math.min(30, Math.max(1, parseInt(sp.get('nights') || '5', 10) || 5))

  const offers = searchPackages({ pax, nights })
  return ok({ provider: 'mock', query: { pax, nights }, count: offers.length, offers })
}
