/* رحلتي — الحجوزات:
   POST  /api/bookings        إنشاء حجز (مع تحقق zod + حد طلب + تأكيد بالبريد v1.4)
   GET   /api/bookings?email=&device=   قائمة حجوزات (يتطلب device مطابق أو توكن صالح) */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, fail, clientIp, readJson, firstZodError, cleanText, mkRef } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { verifyToken, bearerOf } from '@/lib/auth'
import { sendBookingConfirmation } from '@/lib/email'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const createSchema = z.object({
  type: z.enum(['flight', 'hotel', 'package']),
  email: z.string().max(120).regex(EMAIL_RE, 'بريد غير صالح'),
  device: z.string().min(6).max(64),
  totalMad: z.number().min(0).max(10_000_000),
  cur: z.string().min(2).max(4).default('MAD'),
  lang: z.enum(['ar', 'en']).default('ar'),
  visa: z.boolean().default(false),
  title: z.string().max(160).default(''),
  ref: z.string().max(20).optional(), // تُولَّد تلقائياً إن غابت
  payload: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(`bk:${ip}`, 20, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const body = await readJson(req)
  if (!body) return fail('invalid JSON body')

  const err = firstZodError(createSchema, body)
  if (err) return fail(err, 422)

  const b = createSchema.parse(body)
  const ref = b.ref && /^[A-Z]{3}-[A-Z0-9]{4,10}$/.test(b.ref) ? b.ref : mkRef(b.type === 'flight' ? 'FLT' : b.type === 'hotel' ? 'HTL' : 'PKG')

  // ربط بالمستخدم إن وُجد توكن
  const token = bearerOf(req)
  const claims = token ? verifyToken(token) : null
  const userId = claims && claims.email.toLowerCase() === b.email.toLowerCase() ? claims.uid : null

  try {
    const row = await db.booking.create({
      data: {
        ref,
        type: b.type,
        email: b.email.toLowerCase(),
        device: b.device,
        userId,
        title: cleanText(b.title, 160),
        totalMad: b.totalMad,
        cur: b.cur,
        lang: b.lang,
        visa: b.visa,
        payload: JSON.stringify(b.payload).slice(0, 20_000),
      },
    })

    /* [v1.4] تأكيد بالبريد الإلكتروني — fire-and-forget:
       فشل البريد أو غياب المفتاح لا يؤثر على الحجز أبداً */
    try {
      sendBookingConfirmation({
        ref: row.ref,
        type: b.type,
        email: row.email,
        title: row.title,
        totalMad: row.totalMad,
        cur: row.cur,
        lang: b.lang === 'en' ? 'en' : 'ar',
        visa: row.visa,
        createdAt: row.createdAt,
        payload: b.payload,
      })
    } catch {
      /* البريد اختياري دائماً */
    }

    return ok({ booking: shape(row) }, 201)
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'ref already exists' : 'db error'
    return fail(msg, 409)
  }
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(`bkl:${ip}`, 60, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const sp = req.nextUrl.searchParams
  const email = (sp.get('email') || '').trim().toLowerCase()
  const device = (sp.get('device') || '').trim()
  const ref = (sp.get('ref') || '').trim()

  if (ref) {
    if (!/^[A-Z]{3}-[A-Z0-9]{4,10}$/.test(ref)) return fail('invalid ref', 400)
    const row = await db.booking.findUnique({ where: { ref } })
    if (!row) return fail('not found', 404)
    // الوصول لحيازة حجز محدد: توكن صاحبه أو device مطابق أو بريد+جهاز
    const token = bearerOf(req)
    const claims = token ? verifyToken(token) : null
    const owned =
      (claims && claims.email === row.email) ||
      (device && row.device === device) ||
      (email && row.email === email && device === row.device)
    if (!owned) return fail('forbidden', 403)
    return ok({ booking: shape(row) })
  }

  if (!EMAIL_RE.test(email) || device.length < 6)
    return fail('email and device are required', 400)

  const token = bearerOf(req)
  const claims = token ? verifyToken(token) : null
  // لا تُعطَ قائمة حجوزات بريدٍ إلا لصاحبه (جهاز مطابق أو توكن)
  const rows = await db.booking.findMany({
    where: { email, OR: [{ device }, ...(claims?.email === email ? [{ userId: claims!.uid }] : [])] },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok({ count: rows.length, bookings: rows.map(shape) })
}

/* موحّد شكل الصف: payload يُفكّ JSON ليطابق كائن الواجهة تماماً */
function shape(r: {
  ref: string
  type: string
  email: string
  title: string
  totalMad: number
  cur: string
  status: string
  lang: string
  visa: boolean
  payload: string
  createdAt: Date
}) {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(r.payload || '{}')
  } catch {
    payload = {}
  }
  return {
    ref: r.ref,
    type: r.type,
    email: r.email,
    title: r.title,
    totalMad: r.totalMad,
    cur: r.cur,
    status: r.status,
    lang: r.lang,
    visa: r.visa,
    ts: r.createdAt.getTime(),
    ...payload,
  }
}
