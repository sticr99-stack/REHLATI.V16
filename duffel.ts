/* رحلتي — مُحوِّل Duffel الحقيقي (Flights Offer Requests v2)
   البديل الرسمي بعد إغلاق بوابة Amadeus Self-Service في 17 يوليو 2026.
   يُفعَّل تلقائياً فقط عند توفر DUFFEL_API_TOKEN في بيئة السيرفر:
     1) سجّل مجاناً في https://duffel.com  (دقيقة واحدة)
     2) لوحة التحكم → Developers → API tokens → انسخ Test token (duffel_test_...)
     3) ضعه في متغير DUFFEL_API_TOKEN (محلياً .env أو متغيرات Vercel)
   المخرجات بنفس شكل محرك Mock تماماً حتى لا تتغير الواجهة،
   ويرجع null عند أي فشل فيستبدل المحرك المحلي دون أن يرى الزائر خطأً.
   ملاحظة: بيئة الاختبار تعيد بيانات واقعية من خطوط تجريبية (Duffel Airways)
   والأسعار بعملة الحساب — يُحوَّل المبلغ إلى MAD بمعدلات تقريبية أدناه. */

import type { FlightOffer } from './engine'

const API = 'https://api.duffel.com'
const TOKEN = process.env.DUFFEL_API_TOKEN || ''
export const duffelEnabled = Boolean(TOKEN)

/* أسعار تقريبية لتحويل العملات إلى الدرهم (الموقع يعروض أسعاراً إرشادية) */
const TO_MAD: Record<string, number> = {
  MAD: 1, USD: 9.9, EUR: 10.8, GBP: 12.6, AED: 2.7, SAR: 2.64, EGP: 0.2, CAD: 7.2,
}
const toMad = (amount: string | undefined, cur: string | undefined) => {
  const v = parseFloat(amount || '0')
  if (!isFinite(v) || v <= 0) return 0
  return Math.round(v * (TO_MAD[(cur || '').toUpperCase()] ?? 10))
}

/* مدة ISO 8601 مثل PT02H26M أو PT22H10M → دقائق */
const durMin = (d?: string) => {
  const m = d?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  return m ? (+m[1] || 0) * 60 + (+m[2] || 0) : 0
}
const hm = (at?: string) => (at && at.length >= 16 ? at.slice(11, 16) : '--:--')
const dayOf = (at?: string) => (at ? at.slice(0, 10) : '')

type DuffelAirline = { iata_code?: string; name?: string }
type DuffelSegment = {
  departing_at?: string
  arriving_at?: string
  duration?: string
  origin?: { iata_code?: string }
  destination?: { iata_code?: string }
  aircraft?: { name?: string }
  marketing_carrier?: DuffelAirline
  marketing_carrier_flight_number?: string
  passengers?: Array<{ baggages?: Array<{ type?: string; quantity?: number }> }>
}
type DuffelOffer = {
  id?: string
  total_amount?: string
  total_currency?: string
  owner?: DuffelAirline
  slices?: Array<{
    duration?: string
    segments?: DuffelSegment[]
  }>
}

/** بحث طيران حقيقي — يرجع null عند أي فشل (يستدعي الرجوع للمحرك المحلي) */
export async function duffelFlights(q: {
  from: string
  to: string
  date: string
  pax: number
  cls?: string
}): Promise<FlightOffer[] | null> {
  if (!duffelEnabled) return null
  const cabin = q.cls === 'clsBiz' ? 'business' : q.cls === 'clsFirst' ? 'first' : 'economy'
  const pax = Math.max(1, Math.min(9, q.pax))
  try {
    const res = await fetch(`${API}/air/offer_requests?return_offers=true`, {
      method: 'POST',
      headers: {
        'Accept-Encoding': 'gzip',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Duffel-Version': 'v2',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        data: {
          slices: [
            {
              origin: q.from.slice(0, 3).toUpperCase(),
              destination: q.to.slice(0, 3).toUpperCase(),
              departure_date: q.date,
            },
          ],
          passengers: Array.from({ length: pax }, () => ({ type: 'adult' })),
          cabin_class: cabin,
          max_connections: 1,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { data?: { offers?: DuffelOffer[] } }
    const list = j.data?.offers
    if (!Array.isArray(list) || !list.length) return null

    const mapped = list.slice(0, 9).map((o, i): FlightOffer => {
      const slice = o.slices?.[0]
      const segs = slice?.segments ?? []
      const first = segs[0]
      const last = segs[segs.length - 1]
      const stops = Math.max(0, segs.length - 1)
      const al = o.owner?.iata_code || first?.marketing_carrier?.iata_code || 'DF'
      const num = first?.marketing_carrier_flight_number || ''
      /* الأمتعة: أول شريحة/مسافر — إن وُجدت أمتعة مشمولة 23 كغ وإلا يد الطلب فقط */
      const bagChecked = first?.passengers?.[0]?.baggages?.some(
        (b) => b.type === 'checked' && (b.quantity ?? 0) > 0
      )
      const dSum =
        durMin(slice?.duration) ||
        segs.reduce((s, sg) => s + durMin(sg.duration), 0) ||
        300
      return {
        id: o.id || `df-${i}`,
        al,
        no: `${al} ${num}`.trim() || '—',
        dep: hm(first?.departing_at),
        arr: hm(last?.arriving_at),
        dur: dSum,
        stops,
        via: stops ? segs[1]?.origin?.iata_code ?? null : null,
        lay: stops ? 60 : 0,
        plus: dayOf(first?.departing_at) !== dayOf(last?.arriving_at),
        price: toMad(o.total_amount, o.total_currency) || 999,
        bag: bagChecked ? 23 : 8,
        craft: first?.aircraft?.name || 'Airbus A320',
        sc: i + 1,
      }
    })
    return mapped.length ? mapped : null
  } catch {
    return null
  }
}
