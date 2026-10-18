/* رحلتي — الأدوات المشتركة للسيرفر: استجابات موحدة + جلب IP + تحقق zod */

import { NextResponse } from 'next/server'
import { ZodSchema } from 'zod'

export const ok = (data: unknown, init?: number) =>
  NextResponse.json({ ok: true, ...(data as object) }, { status: init ?? 200 })

export const fail = (msg: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, error: msg, ...(extra || {}) }, { status })

/** IP العميل (خلف Caddy/Nginx نعتمد X-Forwarded-For الأول) */
export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'local'
}

/** قراءة JSON بأمان من الطلب */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const j = await req.json()
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

/** تحقق من حقل مقابل مخطط zod — يرجع رسالة أول خطأ أو null */
export function firstZodError(schema: ZodSchema, data: unknown): string | null {
  const r = schema.safeParse(data)
  if (r.success) return null
  const issue = r.error.issues[0]
  return issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'invalid body'
}

/** تنقية نص حر (يُخزَّن ويُعرض لاحقاً) — إزالة وسوم وأحرف تحكم */
export function cleanText(s: string, max = 200): string {
  return s
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
}

/** مرجع حجز فريد بادئة + 6 محارف (نفس أسلوب الواجهة mkRef) */
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function mkRef(prefix: 'FLT' | 'HTL' | 'PKG'): string {
  let tail = ''
  for (let i = 0; i < 6; i++) tail += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  return `${prefix}-${tail}`
}
