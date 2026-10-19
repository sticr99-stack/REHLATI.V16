/* رحلتي — مُحوِّل Amadeus الحقيقي (Flight Offers Search + Hotel Search)
   يُفعَّل تلقائياً فقط عند توفر AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET في .env
   خطوات الحصول على المفاتيح المجانية (بيئة اختبار): https://developers.amadeus.com
   — تسجيل حساب ثم "Self-Service" → إنشاء تطبيق → نسخ Key/Secret إلى .env
   المخرجات بنفس شكل محرك Mock تماماً حتى تبقى الواجهة لا تتغير. */

import type { FlightOffer, HotelOffer } from './engine'

const HOST = process.env.AMADEUS_HOSTNAME === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com'

const CLIENT_ID = process.env.AMADEUS_CLIENT_ID || ''
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || ''
export const amadeusEnabled = Boolean(CLIENT_ID && CLIENT_SECRET)

let token: string | null = null
let tokenExp = 0

async function getToken(): Promise<string | null> {
  if (!amadeusEnabled) return null
  if (token && Date.now() < tokenExp - 60_000) return token
  try {
    const res = await fetch(`${HOST}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!j.access_token) return null
    token = j.access_token
    tokenExp = Date.now() + (j.expires_in ?? 1800) * 1000
    return token
  } catch {
    return null
  }
}

type AmadeusFlight = {
  id: string
  price?: { total?: string }
  validatingAirlineCodes?: string[]
  itineraries?: Array<{
    duration?: string
    segments?: Array<{
      departure?: { at?: string; iataCode?: string }
      arrival?: { at?: string; iataCode?: string }
      carrierCode?: string
      number?: string
      aircraft?: { code?: string }
    }>
  }>
}

const isoHM = (at?: string) => (at ? at.slice(11, 16) : '--:--')
const isoDate = (at?: string) => (at ? at.slice(0, 10) : '')
const isoDayDiff = (a?: string, b?: string) =>
  a && b ? Math.round((+new Date(b) - +new Date(a)) / 86400_000) : 0
const durMin = (d?: string) => {
  const m = d?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  return m ? (+m[1] || 0) * 60 + (+m[2] || 0) : 0
}

/** بحث طيران حقيقي — يرجع null عند أي فشل (يستدعي الرجوع للمحرك المحلي) */
export async function amadeusFlights(q: {
  from: string
  to: string
  date: string
  pax: number
  cls?: string
}): Promise<FlightOffer[] | null> {
  const t = await getToken()
  if (!t) return null
  const travelClass = q.cls === 'clsBiz' ? 'BUSINESS' : q.cls === 'clsFirst' ? 'FIRST' : 'ECONOMY'
  const url = new URL(`${HOST}/v2/shopping/flight-offers`)
  url.searchParams.set('originLocationCode', q.from.slice(0, 3).toUpperCase())
  url.searchParams.set('destinationLocationCode', q.to.slice(0, 3).toUpperCase())
  url.searchParams.set('departureDate', q.date)
  url.searchParams.set('adults', String(Math.max(1, Math.min(9, q.pax))))
  url.searchParams.set('currencyCode', 'MAD')
  url.searchParams.set('max', '9')
  url.searchParams.set('travelClass', travelClass)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { data?: AmadeusFlight[] }
    if (!Array.isArray(j.data)) return null
    return j.data.slice(0, 9).map((f, i): FlightOffer => {
      const it = f.itineraries?.[0]
      const segs = it?.segments ?? []
      const first = segs[0]
      const last = segs[segs.length - 1]
      const stops = Math.max(0, segs.length - 1)
      const mid = stops ? segs[Math.floor(segs.length / 2)]?.departure?.iataCode ?? '' : null
      return {
        id: f.id || `am-${i}`,
        al: f.validatingAirlineCodes?.[0] || first?.carrierCode || 'XX',
        no: `${first?.carrierCode || ''} ${first?.number || ''}`.trim() || '—',
        dep: isoHM(first?.departure?.at),
        arr: isoHM(last?.arrival?.at),
        dur: durMin(it?.duration) || 300,
        stops,
        via: stops ? mid : null,
        lay: stops ? 60 : 0,
        plus: isoDayDiff(first?.departure?.at, last?.arrival?.at) > 0,
        price: Math.round(parseFloat(f.price?.total || '0')) || 999,
        bag: 25,
        craft: first?.aircraft?.code || 'Airbus A320',
        sc: i + 1,
      }
    })
  } catch {
    return null
  }
}

/** بحث فنادق حقيقي — يرجع null عند أي فشل */
export async function amadeusHotels(q: {
  city: string
  ci: string
  co: string
  guests: number
  rooms: number
}): Promise<HotelOffer[] | null> {
  const t = await getToken()
  if (!t) return null
  try {
    // 1) قائمة فنادق المدينة
    const listUrl = new URL(`${HOST}/v1/reference-data/locations/hotels/by-city`)
    listUrl.searchParams.set('cityCode', q.city.slice(0, 3).toUpperCase())
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(12_000),
    })
    if (!listRes.ok) return null
    const list = (await listRes.json()) as { data?: Array<{ hotelId?: string; name?: string }> }
    const ids = (list.data || []).slice(0, 9).map((h) => h.hotelId).filter(Boolean) as string[]
    if (!ids.length) return null

    // 2) الأسعار
    const offUrl = new URL(`${HOST}/v3/shopping/hotel-offers`)
    offUrl.searchParams.set('hotelIds', ids.slice(0, 6).join(','))
    offUrl.searchParams.set('checkInDate', q.ci)
    offUrl.searchParams.set('checkOutDate', q.co)
    offUrl.searchParams.set('adults', String(Math.max(1, Math.min(9, q.guests))))
    offUrl.searchParams.set('roomQuantity', String(Math.max(1, Math.min(6, q.rooms))))
    offUrl.searchParams.set('currency', 'MAD')
    const offRes = await fetch(offUrl, {
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(12_000),
    })
    if (!offRes.ok) return null
    const offs = (await offRes.json()) as {
      data?: Array<{
        hotel?: { hotelId?: string; name?: string; rating?: number }
        offers?: Array<{ price?: { total?: string } }>
      }>
    }
    if (!offs.data?.length) return null
    return offs.data.slice(0, 9).map((d, i): HotelOffer => {
      const stars = Math.max(3, Math.min(5, d.hotel?.rating ?? 4))
      const price = Math.round(parseFloat(d.offers?.[0]?.price?.total || '0')) || 500
      return {
        id: d.hotel?.hotelId || `amh-${i}`,
        stars,
        name: { ar: d.hotel?.name || 'فندق', en: d.hotel?.name || 'Hotel' },
        area: { ar: 'وسط المدينة', en: 'City centre' },
        dist: { ar: 'وسط المدينة', en: 'City centre' },
        rating: 8 + stars * 0.3,
        price,
        am: ['wifi'],
        g: 'from-slate-600 to-slate-800',
        sc: i + 1,
      }
    })
  } catch {
    return null
  }
}
