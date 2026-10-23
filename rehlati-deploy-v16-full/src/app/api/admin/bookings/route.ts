/* رحلتي — بيانات المدير: GET /api/admin/bookings?type=&status=&q=&page=&limit=
   يرجع إحصائيات شاملة + قائمة حجوزات مصفّاة (يتطلب كوكي المدير) */

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, fail, cleanText } from '@/lib/server-utils'
import { adminEnabled, isAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

const TYPES = ['flight', 'hotel', 'package'] as const
const STATUSES = ['confirmed', 'cancelled'] as const

function safePayload(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function GET(req: NextRequest) {
  if (!adminEnabled()) return fail('admin disabled — set ADMIN_PASSCODE first', 403)
  if (!isAdmin(req)) return fail('unauthorized', 401)

  const sp = req.nextUrl.searchParams
  const type = (sp.get('type') || '').trim()
  const status = (sp.get('status') || '').trim()
  const q = cleanText(sp.get('q') || '', 120)
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(5, parseInt(sp.get('limit') || '20', 10) || 20))

  const where: Prisma.BookingWhereInput = {}
  if ((TYPES as readonly string[]).includes(type)) where.type = type
  if ((STATUSES as readonly string[]).includes(status)) where.status = status
  if (q) {
    where.OR = [
      { email: { contains: q.toLowerCase(), mode: 'insensitive' } },
      { ref: { contains: q.toUpperCase() } },
      { title: { contains: q, mode: 'insensitive' } },
    ]
  }

  const midnightUtc = new Date(new Date().setUTCHours(0, 0, 0, 0))

  const [total, bookings, revAgg, byType, byStatus, todayCount] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.booking.aggregate({
      _sum: { totalMad: true },
      _count: { _all: true },
      where: { status: 'confirmed' },
    }),
    db.booking.groupBy({ by: ['type'], _count: { _all: true } }),
    db.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    db.booking.count({ where: { createdAt: { gte: midnightUtc } } }),
  ])

  return ok({
    stats: {
      total,
      filtered: total,
      confirmed: revAgg._count._all,
      revenueConfirmedMad: Number((revAgg._sum.totalMad ?? 0).toFixed(2)),
      today: todayCount,
      byType: Object.fromEntries(byType.map((g) => [g.type, g._count._all])),
      byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    bookings: bookings.map((b) => ({
      ref: b.ref,
      type: b.type,
      email: b.email,
      title: b.title,
      totalMad: b.totalMad,
      cur: b.cur,
      status: b.status,
      lang: b.lang,
      visa: b.visa,
      registered: !!b.userId,
      createdAt: b.createdAt.toISOString(),
      payload: safePayload(b.payload),
    })),
  })
}
