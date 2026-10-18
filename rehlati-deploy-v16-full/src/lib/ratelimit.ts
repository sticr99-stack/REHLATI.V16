/* رحلتي — حد الطلب (Rate Limiting) في الذاكرة
   نافذة ثابتة لكل مفتاح (IP أو IP+مسار). يكفي للنسخة الحالية؛
   عند التوزع لاحقاً يُستبدل بـ Redis بنفس الواجهة. */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** يرجع null إن مسموح، أو milliseconds حتى الإتاحة */
export function rateLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) prune(now)
    return null
  }
  b.count++
  if (b.count > limit) return b.resetAt - now
  return null
}

function prune(now: number) {
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
}
