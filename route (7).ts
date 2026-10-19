/* رحلتي — بيانات الحساب الحالي: GET /api/auth/me (Bearer token) */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, fail } from '@/lib/server-utils'
import { verifyToken, bearerOf } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = bearerOf(req)
  if (!token) return fail('missing token', 401)
  const claims = verifyToken(token)
  if (!claims) return fail('invalid or expired token', 401)

  const user = await db.user.findUnique({ where: { id: claims.uid } })
  if (!user) return fail('user not found', 404)

  return ok({ user: { id: user.id, email: user.email, name: user.name, lang: user.lang } })
}
