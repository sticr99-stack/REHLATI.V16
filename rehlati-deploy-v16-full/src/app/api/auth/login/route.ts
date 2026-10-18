/* رحلتي — تسجيل الدخول: POST /api/auth/login { email, password }
   مع تسجيل المحاولات الفاشلة وقفل مؤقت بعد 8 إخفاقات في 10 دقائق */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, fail, clientIp, readJson, firstZodError } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { verifyPassword, signToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'بريد غير صالح'),
  password: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(`log:${ip}`, 15, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const body = await readJson(req)
  if (!body) return fail('invalid JSON body')
  const err = firstZodError(loginSchema, body)
  if (err) return fail(err, 422)
  const b = loginSchema.parse(body)

  const email = b.email.toLowerCase()
  const since = new Date(Date.now() - 10 * 60_000)
  const fails = await db.loginAttempt.count({
    where: { email, ok: false, createdAt: { gte: since } },
  })
  if (fails >= 8) return fail('account temporarily locked (too many attempts)', 423)

  const user = await db.user.findUnique({ where: { email } })
  const valid = user ? verifyPassword(b.password, user.passwordHash) : false

  try {
    await db.loginAttempt.create({ data: { email, ip, ok: valid } })
  } catch {}

  if (!user || !valid) return fail('wrong email or password', 401)

  const token = signToken({ uid: user.id, email: user.email })
  return ok({ token, user: { id: user.id, email: user.email, name: user.name, lang: user.lang } })
}
