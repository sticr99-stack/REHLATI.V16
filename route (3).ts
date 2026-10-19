/* رحلتي — بحث الفنادق: Amadeus إن توفرت المفاتيح وإلا المحرك المحلي */
import { NextRequest } from 'next/server'
import { ok, fail, clientIp } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { searchHotels } from '@/lib/engine'
import { amadeusEnabled, amadeusHotels } from '@/lib/amadeus'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const limited = rateLimit(`htl:${clientIp(req)}`, 30, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const sp = req.nextUrl.searchParams
  const city = (sp.get('city') || 'DXB').trim().slice(0, 60)
  const ci = sp.get('ci') || ''
  const co = sp.get('co') || ''
  const guests = Math.min(14, Math.max(1, parseInt(sp.get('guests') || '2', 10) || 2))
  const rooms = Math.min(6, Math.max(1, parseInt(sp.get('rooms') || '1', 10) || 1))

  if (!/^[\w\s\u0600-\u06FF-]{1,60}$/.test(city)) return fail('invalid city', 400)
  if (!DATE_RE.test(ci) || !DATE_RE.test(co)) return fail('invalid dates (YYYY-MM-DD)', 400)
  if (new Date(co) <= new Date(ci)) return fail('checkout must be after checkin', 400)

  const q = { city, ci, co, guests, rooms }
  let provider: 'amadeus' | 'mock' = 'mock'
  let offers = null

  if (amadeusEnabled) {
    offers = await amadeusHotels(q)
    if (offers) provider = 'amadeus'
  }
  if (!offers) offers = searchHotels(q)

  return ok({ provider, query: q, count: offers.length, offers })
}
