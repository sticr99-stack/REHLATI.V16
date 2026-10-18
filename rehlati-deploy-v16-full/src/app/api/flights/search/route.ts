/* رحلتي — بحث الطيران: Amadeus إن توفرت المفاتيح وإلا المحرك المحلي */
import { NextRequest } from 'next/server'
import { ok, fail, clientIp } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { searchFlights } from '@/lib/engine'
import { amadeusEnabled, amadeusFlights } from '@/lib/amadeus'

export const dynamic = 'force-dynamic'

const CODE_RE = /^[a-zA-Z\s\u0600-\u06FF-]{0,60}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const limited = rateLimit(`fly:${clientIp(req)}`, 30, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const sp = req.nextUrl.searchParams
  const from = (sp.get('from') || 'CMN').trim().slice(0, 60)
  const to = (sp.get('to') || 'DXB').trim().slice(0, 60)
  const date = sp.get('date') || ''
  const pax = Math.min(9, Math.max(1, parseInt(sp.get('pax') || '1', 10) || 1))
  const cls = sp.get('cls') || undefined

  if (!CODE_RE.test(from) || !CODE_RE.test(to)) return fail('invalid city', 400)
  if (!DATE_RE.test(date)) return fail('invalid date (YYYY-MM-DD)', 400)

  const q = { from, to, date, pax, cls }
  let provider: 'amadeus' | 'mock' = 'mock'
  let offers = null

  if (amadeusEnabled) {
    offers = await amadeusFlights(q)
    if (offers) provider = 'amadeus'
  }
  if (!offers) offers = searchFlights(q)

  return ok({ provider, query: q, count: offers.length, offers })
}
