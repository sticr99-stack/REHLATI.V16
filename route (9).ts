/* رحلتي — إنشاء حساب: POST /api/auth/register { name, email, password } */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, fail, clientIp, readJson, firstZodError } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { hashPassword, signToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const regSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'بريد غير صالح'),
  password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل').max(100),
  lang: z.enum(['ar', 'en']).default('ar'),
})

export async function POST(req: NextRequest) {
  const limited = rateLimit(`reg:${clientIp(req)}`, 10, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  const body = await readJson(req)
  if (!body) return fail('invalid JSON body')
  const err = firstZodError(regSchema, body)
  if (err) return fail(err, 422)
  const b = regSchema.parse(body)

  const exists = await db.user.findUnique({ where: { email: b.email.toLowerCase() } })
  if (exists) return fail('email already registered', 409)

  const user = await db.user.create({
    data: {
      email: b.email.toLowerCase(),
      name: b.name.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 60),
      passwordHash: hashPassword(b.password),
      lang: b.lang,
    },
  })
  const token = signToken({ uid: user.id, email: user.email })
  return ok({ token, user: { id: user.id, email: user.email, name: user.name, lang: user.lang } }, 201)
}
