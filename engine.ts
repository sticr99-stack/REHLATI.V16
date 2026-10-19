/* رحلتي — محرك البحث المحلي (Mock Engine)
   يولّد عروض طيران/فنادق/باقات بأسعار MAD بنفس أشكال بطاقات الواجهة تماماً:
   طيران: { id, al, no, dep, arr, dur, stops, via, lay, plus, price, bag, craft, sc }
   فندق:  { id, stars, name:{ar,en}, area:{ar,en}, dist:{ar,en}, rating, price, am[], g, sc }
   عند توفر مفاتيح AMADEUS يستبدله المحرك الحقيقي (amadeus.ts) بنفس الواجهة. */

export type FlightOffer = {
  id: string
  al: string
  no: string
  dep: string
  arr: string
  dur: number
  stops: number
  via: string | null
  lay: number
  plus: boolean
  price: number
  bag: number
  craft: string
  sc: number
}

export type HotelOffer = {
  id: string
  stars: number
  name: { ar: string; en: string }
  area: { ar: string; en: string }
  dist: { ar: string; en: string }
  rating: number
  price: number
  am: string[]
  g: string
  sc: number
}

export type PkgOffer = {
  id: string
  dest: { ar: string; en: string }
  title: { ar: string; en: string }
  nights: number
  hotel: { ar: string; en: string }
  price: number
  g: string
  inc: string[]
  tag: boolean
}

const AIRLINES = [
  { al: 'AT', no: 'AT', c1: 'Boeing 787-8', bag: 25 },
  { al: 'EK', no: 'EK', c1: 'Boeing 777-300ER', bag: 30 },
  { al: 'QR', no: 'QR', c1: 'Airbus A350-900', bag: 25 },
  { al: 'SV', no: 'SV', c1: 'Airbus A321neo', bag: 25 },
  { al: 'FR', no: 'FR', c1: 'Boeing 737-800', bag: 20 },
  { al: 'VY', no: 'VY', c1: 'Airbus A320neo', bag: 20 },
] as const

/* نقاط العور محصورة بما تعرفه بطاقات الواجهة (خريطة VIA في صفحة النتائج) */
const VIA_POINTS = ['JED', 'DOH', 'CAI', 'MAD', 'BCN'] as const
const CRAFTS = ['Boeing 787-9', 'Airbus A350-1000', 'Boeing 777-300ER', 'Airbus A321neo', 'Boeing 737-800'] as const
const GRADIENTS = [
  'from-cyan-600 to-blue-800',
  'from-amber-500 to-orange-700',
  'from-emerald-600 to-teal-800',
  'from-violet-600 to-purple-800',
  'from-rose-500 to-red-700',
  'from-slate-600 to-slate-800',
] as const

/** مولّد شبه حتمي من نص البحث — نتائج ثابتة لنفس المعايير (قابل للتخزين المؤقت) */
function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let s = seed || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const hm = (mins: number) => `${pad(Math.floor((mins % 1440) / 60))}:${pad(mins % 60)}`

/** بحث طيران: من/إلى (أكواد IATA أو نص حر) + تاريخ + مسافرون + درجة */
export function searchFlights(q: {
  from: string
  to: string
  date: string
  pax: number
  cls?: string
  ret?: string | null
}): FlightOffer[] {
  const base = seedOf(`${q.from}|${q.to}|${q.date}|${q.cls || 'eco'}`)
  const r = rng(base)
  const mult = q.cls === 'clsBiz' ? 2.6 : q.cls === 'clsFirst' ? 4.2 : 1
  const paxMult = Math.max(1, Math.min(9, q.pax))
  const offers: FlightOffer[] = []
  const n = 7 + Math.floor(r() * 3) // 7-9 عروض مثل الواجهة
  for (let i = 0; i < n; i++) {
    const A = AIRLINES[Math.floor(r() * AIRLINES.length)]
    const stops = r() < 0.35 ? 0 : 1
    const dur = 120 + Math.floor(r() * 600) + stops * 90
    const depMin = Math.floor(r() * 1440)
    const price = Math.round((340 + r() * 2400) * mult * (0.9 + 0.2 * paxMult))
    offers.push({
      id: `${A.al.toLowerCase()}${1000 + Math.floor(r() * 8999)}x${i}`,
      al: A.al,
      no: `${A.no} ${1000 + Math.floor(r() * 8999)}`,
      dep: hm(depMin),
      arr: hm(depMin + dur),
      dur,
      stops,
      via: stops ? VIA_POINTS[Math.floor(r() * VIA_POINTS.length)] : null,
      lay: stops ? 55 + Math.floor(r() * 120) : 0,
      plus: depMin + dur >= 1440,
      price,
      bag: A.bag,
      craft: CRAFTS[Math.floor(r() * CRAFTS.length)],
      sc: i + 1,
    })
  }
  return offers.sort((a, b) => a.price - b.price)
}

const HOTEL_NAMES: Array<[string, string]> = [
  ['أتلانتس ذا بالم', 'Atlantis The Palm'],
  ['جراند حياة المدينة', 'Grand Hyatt City'],
  ['رافلز البحر', 'Raffles by the Sea'],
  ['كراون بلازا سنتر', 'Crowne Plaza Centre'],
  ['راديسون بلو', 'Radisson Blu'],
  ['إبيس الأجواء', 'ibis Ambiance'],
  ['ميريوت الحي المالي', 'Marriott Financial District'],
  ['فور سيزونز الكورنيش', 'Four Seasons Corniche'],
]
const AREAS: Array<[string, string]> = [
  ['وسط المدينة', 'City centre'],
  ['على الشاطئ', 'Beachfront'],
  ['قرب المترو', 'Near metro'],
  ['الحي المالي', 'Financial district'],
  ['الكورنيش', 'Corniche'],
]
const AMEN = ['wifi', 'breakfast', 'pool', 'beach', 'parking', 'spa'] as const

export function searchHotels(q: { city: string; ci: string; co: string; guests: number; rooms: number }): HotelOffer[] {
  const nights = Math.max(1, Math.round((+new Date(q.co) - +new Date(q.ci)) / 86400_000) || 1)
  const r = rng(seedOf(`${q.city}|${q.ci}|${q.co}|${q.guests}|${q.rooms}`))
  const offers: HotelOffer[] = []
  const n = 6 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const stars = 3 + Math.floor(r() * 3)
    const [ar, en] = HOTEL_NAMES[Math.floor(r() * HOTEL_NAMES.length)]
    const [aAr, aEn] = AREAS[Math.floor(r() * AREAS.length)]
    const base = 200 + r() * 2600 * Math.max(1, stars - 2)
    offers.push({
      id: `h${seedOf(q.city + i) % 100000}-${i}`,
      stars,
      name: { ar, en },
      area: { ar: aAr, en: aEn },
      dist: { ar: aAr, en: aEn },
      rating: Math.min(9.7, 7.6 + r() * 2.2),
      price: Math.round((base * nights * Math.max(1, q.rooms)) / 1),
      am: AMEN.filter(() => r() < 0.55).slice(0, 4).length ? AMEN.filter(() => r() < 0.5).slice(0, 4) : ['wifi'],
      g: GRADIENTS[i % GRADIENTS.length],
      sc: i + 1,
    })
  }
  return offers.sort((a, b) => a.price - b.price)
}

const PKG_CITIES: Array<[string, string, string]> = [
  ['دبي', 'Dubai', 'DXB'],
  ['إسطنبول', 'Istanbul', 'IST'],
  ['باريس', 'Paris', 'CDG'],
  ['كوالالمبور', 'Kuala Lumpur', 'KUL'],
  ['القاهرة', 'Cairo', 'CAI'],
  ['مالقة', 'Malaga', 'AGP'],
]

const PKG_TITLES: Array<[string, string]> = [
  ['الفخامة الشاملة', 'All-Inclusive Luxury'],
  ['عبر قارتين', 'Two Continents'],
  ['سحر المدينة', 'City Magic'],
  ['شاطئ ومغامرة', 'Beach & Adventure'],
  ['استكشاف عاصمي', 'Capital Explorer'],
]
const PKG_INC = [['flight', 'hotel', 'breakfast', 'safari'], ['flight', 'hotel', 'breakfast', 'tour'], ['flight', 'hotel', 'breakfast', 'transfer']] as const
const PKG_GRADS = ['from-amber-400 to-orange-500', 'from-cyan-500 to-blue-600', 'from-orange-400 to-rose-500', 'from-emerald-500 to-teal-700', 'from-violet-500 to-purple-700'] as const

export function searchPackages(q: { pax: number; nights: number }): PkgOffer[] {
  const r = rng(seedOf(`pkg|${q.pax}|${q.nights}`))
  return PKG_CITIES.map((c, i) => {
    const [cAr, cEn, code] = c
    const [hAr, hEn] = HOTEL_NAMES[Math.floor(r() * HOTEL_NAMES.length)]
    const [tAr, tEn] = PKG_TITLES[Math.floor(r() * PKG_TITLES.length)]
    const nights = q.nights || 5
    const inc = PKG_INC[Math.floor(r() * PKG_INC.length)]
    return {
      id: `pk-${code.toLowerCase()}-${i}`,
      dest: { ar: `${cAr}`, en: `${cEn}` },
      title: { ar: `${cAr} — ${tAr}`, en: `${cEn} — ${tEn}` },
      nights,
      hotel: { ar: hAr, en: hEn },
      price: Math.round((2400 + r() * 6800) * Math.max(1, q.pax)),
      g: PKG_GRADS[i % PKG_GRADS.length],
      inc: [...inc],
      tag: i === 0,
    }
  }).sort((a, b) => a.price - b.price)
}

/* ---------- مطارات/مدن للإكمال التلقائي ---------- */
export const AIRPORTS = [
  { code: 'CMN', city: { ar: 'الدار البيضاء', en: 'Casablanca' }, country: { ar: 'المغرب', en: 'Morocco' } },
  { code: 'RAK', city: { ar: 'مراكش', en: 'Marrakech' }, country: { ar: 'المغرب', en: 'Morocco' } },
  { code: 'RBA', city: { ar: 'الرباط', en: 'Rabat' }, country: { ar: 'المغرب', en: 'Morocco' } },
  { code: 'TNG', city: { ar: 'طنجة', en: 'Tangier' }, country: { ar: 'المغرب', en: 'Morocco' } },
  { code: 'AGA', city: { ar: 'أكادير', en: 'Agadir' }, country: { ar: 'المغرب', en: 'Morocco' } },
  { code: 'DXB', city: { ar: 'دبي', en: 'Dubai' }, country: { ar: 'الإمارات', en: 'UAE' } },
  { code: 'AUH', city: { ar: 'أبو ظبي', en: 'Abu Dhabi' }, country: { ar: 'الإمارات', en: 'UAE' } },
  { code: 'JED', city: { ar: 'جدة', en: 'Jeddah' }, country: { ar: 'السعودية', en: 'Saudi Arabia' } },
  { code: 'RUH', city: { ar: 'الرياض', en: 'Riyadh' }, country: { ar: 'السعودية', en: 'Saudi Arabia' } },
  { code: 'DOH', city: { ar: 'الدوحة', en: 'Doha' }, country: { ar: 'قطر', en: 'Qatar' } },
  { code: 'CAI', city: { ar: 'القاهرة', en: 'Cairo' }, country: { ar: 'مصر', en: 'Egypt' } },
  { code: 'IST', city: { ar: 'إسطنبول', en: 'Istanbul' }, country: { ar: 'تركيا', en: 'Türkiye' } },
  { code: 'CDG', city: { ar: 'باريس', en: 'Paris' }, country: { ar: 'فرنسا', en: 'France' } },
  { code: 'MAD', city: { ar: 'مدريد', en: 'Madrid' }, country: { ar: 'إسبانيا', en: 'Spain' } },
  { code: 'BCN', city: { ar: 'برشلونة', en: 'Barcelona' }, country: { ar: 'إسبانيا', en: 'Spain' } },
  { code: 'LHR', city: { ar: 'لندن', en: 'London' }, country: { ar: 'بريطانيا', en: 'UK' } },
  { code: 'JFK', city: { ar: 'نيويورك', en: 'New York' }, country: { ar: 'أمريكا', en: 'USA' } },
  { code: 'KUL', city: { ar: 'كوالالمبور', en: 'Kuala Lumpur' }, country: { ar: 'ماليزيا', en: 'Malaysia' } },
]

export function searchAirports(q: string, lang: 'ar' | 'en' = 'ar') {
  const s = q.trim().toLowerCase()
  if (!s) return AIRPORTS.slice(0, 8)
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(s) ||
      a.city.ar.includes(q.trim()) ||
      a.city.en.toLowerCase().includes(s) ||
      a.country.en.toLowerCase().includes(s) ||
      a.country.ar.includes(q.trim())
  ).slice(0, 8)
}
