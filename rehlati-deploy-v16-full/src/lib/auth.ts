/* رحلتي — المصادقة: تشفير كلمات السر scrypt + توكن HMAC-SHA256
   بدون تبعيات خارجية (node:crypto) — آمن ومحمول على أي استضافة Node 18+ */

import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto'

const SECRET: string =
  process.env.JWT_SECRET ||
  process.env.AUTH_SECRET ||
  'rehlati-dev-secret-change-me-in-production'

const KEY_LEN = 64

/** hash بصيغة: salt:hex */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const calc = scryptSync(password, salt, KEY_LEN)
    const ref = Buffer.from(hash, 'hex')
    return calc.length === ref.length && timingSafeEqual(calc, ref)
  } catch {
    return false
  }
}

/* ---------- توكن: base64url(payload).signature ---------- */

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const b64uDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

export type TokenPayload = { uid: string; email: string; exp: number }

export function signToken(payload: Omit<TokenPayload, 'exp'>, days = 30): string {
  const body: TokenPayload = {
    ...payload,
    exp: Date.now() + days * 86400_000,
  }
  const data = b64u(JSON.stringify(body))
  const sig = createHmac('sha256', SECRET).update(data).digest()
  return `${data}.${b64u(sig)}`
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [data, sig] = token.split('.')
    if (!data || !sig) return null
    const expected = createHmac('sha256', SECRET).update(data).digest()
    const given = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    const payload = JSON.parse(b64uDecode(data)) as TokenPayload
    if (!payload?.uid || !payload?.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/** استخراج الحامل من ترويسة Authorization أو من rehlati_token (احتياط) */
export function bearerOf(req: Request): string | null {
  const h = req.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  return null
}
