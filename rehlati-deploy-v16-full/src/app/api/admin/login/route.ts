/* رحلتي — دخول المدير: POST /api/admin/login { passcode } → كوكي HttpOnly (12 ساعة)
   DELETE /api/admin/login → خروج (مسح الكوكي)
   البوابة معطلة (403) إن لم يُضبط ADMIN_PASSCODE في متغيرات البيئة */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, clientIp, readJson, firstZodError } from '@/lib/server-utils'
import { rateLimit } from '@/lib/ratelimit'
import { ADMIN_COOKIE, ADMIN_TTL_SEC, adminEnabled, passcodeMatches, issueAdminToken } from '@/lib/admin'

export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  passcode: z.string().min(1, 'أدخل كلمة السر').max(200),
})

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(`adm:${ip}`, 8, 60_000)
  if (limited) return fail('rate limited', 429, { retryAfterMs: limited })

  if (!adminEnabled()) return fail('admin disabled — set ADMIN_PASSCODE first', 403)

  const body = await readJson(req)
  if (!body) return fail('invalid JSON body')
  const err = firstZodError(loginSchema, body)
  if (err) return fail(err, 422)
  const { passcode } = loginSchema.parse(body)

  if (!passcodeMatches(passcode)) return fail('wrong passcode', 401)

  const res = ok({ role: 'admin', expiresInSec: ADMIN_TTL_SEC })
  res.cookies.set(ADMIN_COOKIE, issueAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_SEC,
  })
  return res
}

export async function DELETE() {
  const res = ok({ bye: true })
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
