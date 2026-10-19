// رحلتي — db-sync: مزامنة مخطط Prisma مع قاعدة البيانات تلقائياً (idempotent)
// متى تعمل؟ ضمن postinstall: أي تثبيت (Vercel / Docker / محلي) ينشئ أو يحدّث الجداول
// دون أي أمر يدوي. منطق الأمان:
//   - بلا DATABASE_URL أو برابط file: → تخطٍ صامت (لا يكسر البناء أبداً)
//   - برابط postgres صالح → prisma db push --skip-generate (يفشل بصوت عالٍ عند رابط خاطئ
//     ليبقى النشر القديم حياً ويظهر السبب في لوج النشر)
// تعمل تحت node (npx) أو bun (bunx) حسب البيئة.

import { spawnSync } from 'node:child_process'

const url = (process.env.DATABASE_URL || '').trim()
const log = (...a) => console.log('[db-sync]', ...a)

if (!url) {
  log('DATABASE_URL غير مضبوط — تخطي المزامنة (النشر سيتمّ، والحجوزات تحتاج رابط قاعدة)')
  process.exit(0)
}
if (url.startsWith('file:')) {
  log('رابط SQLite محلي (file:) — تخطي: مخطط المستودع الآن postgresql')
  process.exit(0)
}
if (!/^(postgres|postgresql):\/\//.test(url)) {
  log('DATABASE_URL ليس رابط postgres — تخطي المزامنة')
  process.exit(0)
}

// اختيار المشغّل: bunx تحت bun و npx تحت node، مع fallback للآخر عند غيابه
const launchers = process.versions.bun ? ['bunx', 'npx'] : ['npx', 'bunx']
let r = null
for (const bin of launchers) {
  r = spawnSync(bin, ['prisma', 'db', 'push', '--skip-generate'], { stdio: 'inherit' })
  if (!r.error || r.error.code !== 'ENOENT') break
  log(`${bin} غير متوفر — محاولة بديلة...`)
}

if (!r || r.status !== 0) {
  console.error('[db-sync] ✗ فشلت مزامنة المخطط — راجع DATABASE_URL (يجب أن ينتهي بـ ?sslmode=require لـ Neon)')
  process.exit(r ? (r.status ?? 1) : 1)
}
log('✓ قاعدة البيانات جاهزة — المخطط متزامن')
