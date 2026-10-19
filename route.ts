/* رحلتي — حجز واحد:
   GET    /api/bookings/[ref]?device=   تفاصيل (صاحب الحجز فقط)
   DELETE /api/bookings/[ref]?device=   إلغاء نهائي (صاحب الحجز فقط) */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, fail, clientIp } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { verifyToken, bearerOf } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const REF_RE = /^[A-Z]{3}-[A-Z0-9]{4,10}$/

function owned(row: { email: string; device: string }, req: NextRequest): boolean {
  const device = req.nextUrl.searchParams.get('device') || ''
  if (device && row.device && row.device === device) return true
  const token = bearerOf(req)
  if (token) {
    const claims = verifyToken(token)
    if (claims && claims.email === row.email) return true
  }
  return false
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const limited = rateLimit(`bg:${clientIp(req)}`, 60, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const { ref } = await ctx.params
  if (!REF_RE.test(ref)) return fail('invalid ref', 400)
  const row = await db.booking.findUnique({ where: { ref } })
  if (!row) return fail('not found', 404)
  if (!owned(row, req)) return fail('forbidden', 403)

  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(row.payload || '{}')
  } catch {}
  return ok({
    booking: {
      ref: row.ref,
      type: row.type,
      email: row.email,
      title: row.title,
      totalMad: row.totalMad,
      cur: row.cur,
      status: row.status,
      lang: row.lang,
      visa: row.visa,
      ts: row.createdAt.getTime(),
      ...payload,
    },
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const limited = rateLimit(`bd:${clientIp(req)}`, 30, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const { ref } = await ctx.params
  if (!REF_RE.test(ref)) return fail('invalid ref', 400)
  const row = await db.booking.findUnique({ where: { ref } })
  if (!row) return fail('not found', 404)
  if (!owned(row, req)) return fail('forbidden', 403)

  await db.booking.delete({ where: { ref } })
  return ok({ deleted: ref })
}
