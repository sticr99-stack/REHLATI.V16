/* رحلتي — بوابة المدير (Admin Gate)
   كلمة سر واحدة من متغير البيئة ADMIN_PASSCODE + كوكي HttpOnly موقّعة HMAC
   (نفس محرك توكنات auth.ts — بلا تبعيات خارجية).
   ملاحظات أمنية:
   - البوابة معطلة تماماً إن لم يُضبط ADMIN_PASSCODE (لا باب خلفي)
   - المقارنة زمن-ثابت عبر sha256 (آمنة ضد هجمات التوقيت وتفاوت الأطوال)
   - الكوكي HttpOnly + SameSite=Lax + Secure في الإنتاج — لا يقرأها جافاسكربت */

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { TokenPayload } from '@/lib/auth'

export const ADMIN_COOKIE = 'rehlati_admin'
export const ADMIN_TTL_SEC = 43_200 // 12 ساعة

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const b64uDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

/** مفتاح التوقيع مشتق من SECRET + كلمة السر نفسها:
    تغيير ADMIN_PASSCODE في Vercel يبطل كل جلسات المدير المفتوحة فوراً */
function adminKey(): string {
  return createHash('sha256')
    .update(`${process.env.JWT_SECRET || process.env.AUTH_SECRET || 'rehlati-dev-secret'}::${process.env.ADMIN_PASSCODE || ''}`)
    .digest('hex')
}

/** هل البوابة مفعّلة؟ (كلمة سر لا تقل عن 8 محارف) */
export function adminEnabled(): boolean {
  const p = process.env.ADMIN_PASSCODE
  return typeof p === 'string' && p.length >= 8
}

/** مقارنة كلمة السر بزمن-ثابت */
export function passcodeMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSCODE || ''
  const a = createHash('sha256').update(input, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

/** توكن المدير: HMAC-SHA256 بمفتاح مشتق، بصلاحية 12 ساعة */
export function issueAdminToken(): string {
  const body: TokenPayload = {
    uid: 'admin',
    email: 'admin@rehlati.local',
    exp: Date.now() + ADMIN_TTL_SEC * 1000,
  }
  const data = b64u(JSON.stringify(body))
  const sig = createHmac('sha256', adminKey()).update(data).digest()
  return `${data}.${b64u(sig)}`
}

/** فحص كوكي المدير من الطلب */
export function isAdmin(req: Request): boolean {
  const cookie = req.headers.get('cookie') || ''
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`))
  if (!m) return false
  try {
    const token = decodeURIComponent(m[1])
    const [data, sig] = token.split('.')
    if (!data || !sig) return false
    const expected = createHmac('sha256', adminKey()).update(data).digest()
    const given = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
    const payload = JSON.parse(b64uDecode(data)) as TokenPayload
    return payload?.uid === 'admin' && !!payload?.exp && payload.exp > Date.now()
  } catch {
    return false
  }
}
