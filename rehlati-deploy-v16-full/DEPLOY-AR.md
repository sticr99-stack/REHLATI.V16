# 🚀 دليل نشر موقع «رحلتي» على استضافة حقيقية — خطوة بخطوة

هذا الدليل ينقلك من الموقع المحلي إلى **موقع حي على الإنترنت بسيرفر و API حقيقيين**.
اختار المسار المناسب لك حسب ميزانيتك وخبرتك — كلها تُنجز في أقل من ساعة.

> 📦 **نقطة البداية:** فك ضغط `rehlati-deploy-v16-full.zip` — المجلد الناتج هو المشروع الكامل
> (الموقع + السيرفر + قاعدة البيانات + Docker) المُختبر ببناء إنتاجي فعلي، وكل الخطوات أدناه تُنفَّذ داخله.

---

## ما الذي بُني في هذه النسخة؟

```
┌────────────────────────────────────────────────────────────┐
│                    المتصفح (الموقع الساكن)                  │
│   index.html · results · booking · my-trips · sign-in      │
│              + جسر js/api-bridge.js (اتصال تلقائي)          │
└──────────────────────────┬─────────────────────────────────┘
                           │ fetch (نفس الأصل فقط)
┌──────────────────────────▼─────────────────────────────────┐
│                  سيرفر Next.js 16 (API Routes)              │
│  /api/health · /api/airports · /api/flights/search          │
│  /api/hotels/search · /api/packages/search                  │
│  /api/bookings (+ [ref]) · /api/auth (register/login/me)    │
├────────────────────────────────────────────────────────────┤
│  الأمان: تحقق Zod · حد الطلب · توقيع HMAC · scrypt          │
│  محرك الطيران: Amadeus الحقيقي عند توفر المفاتيح،           │
│  وإلا محرك محاكاة داخلي بأسعار MAD (الموقع يعمل دائماً)     │
├────────────────────────────────────────────────────────────┤
│  قاعدة البيانات: SQLite (افتراضي) أو Postgres (سحابي)       │
└────────────────────────────────────────────────────────────┘
```

**نقطة مهمة:** الموقع يعمل في كل الحالات — إن سقط السيرفر أو فُتح الملف محلياً (`file://`)
يعود تلقائياً للوضع المحلي (localStorage) دون أي كسر.

---

## المسار 1 — Vercel (مجاني، الأسهل) ⭐ موصى به للبداية

> استضافة عالمية، شهادة SSL تلقائية، ونطاق `*.vercel.app` جاهز فوراً.

1. ارفع المشروع إلى GitHub:
   ```bash
   git init && git add -A && git commit -m "Rehlati v16 — server + API"
   git branch -M main
   git remote add origin https://github.com/USERNAME/rehlati.git
   git push -u origin main
   ```
2. ادخل إلى [vercel.com](https://vercel.com) بسجل GitHub → **Add New Project** → اختر المستودع → **Deploy** (اكتفي بالإعدادات الافتراضية).
3. أضف متغيرات البيئة: Settings → Environment Variables:
   - `JWT_SECRET` = سلسلة عشوائية طويلة (`openssl rand -hex 32`)
   - `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` (اختياري — انظر الأسفل)
4. **قاعدة البيانات على Vercel**: نظام الملفات هناك مؤقت، فبدّل إلى Postgres المجاني:
   - أنشئ قاعدة في [neon.tech](https://neon.tech) (الخطة المجانية كافية) وانسخ `DATABASE_URL`.
   - في `prisma/schema.prisma` غيّر سطراً واحداً: `provider = "postgresql"`.
   - ضع `DATABASE_URL` في متغيرات Vercel ثم أعد النشر.
5. موقعك حي على `https://your-project.vercel.app` — افتحه وجرّب بحثاً وحجزاً.

## المسار 2 — VPS (تحكم كامل، ~5$/شهر) مع Docker و HTTPS تلقائي

> مناسب لـ Hostinger / Contabo / DigitalOcean / أي VPS بـ Ubuntu 22+.

```bash
# 1) ارفع مجلد المشروع إلى السيرفر ثم:
cd /var/www/rehlati
cp .env.example .env && nano .env        # ضع JWT_SECRET حقيقياً

# 2) شغّل كل شيء (تطبيق + قاعدة + HTTPS):
docker compose up -d --build

# 3) في deploy/Caddyfile بدّل your-domain.com بنطاقك، ثم:
docker compose restart caddy
```
- وجّه سجل DNS للنطاق (سجل A → IP السيرفر) و Caddy يصدر شهادة SSL **تلقائياً**.
- للتحديث لاحقاً: `git pull && docker compose up -d --build`.
- بديل بلا Docker: `bun install && bun run build && pm2 start deploy/ecosystem.config.js` + Nginx كوكيل عكسي.

## المسار 3 — Railway / Render (وسط بين المسارين)

- اربط مستودع GitHub → **New Project → Deploy from repo**.
- Railway يكتشف Next.js تلقائياً؛ أضف متغيرات البيئة نفسها.
- للقاعدة: أضف إضافة Postgres داخل المنصة نفسها واستعمل `DATABASE_URL` الخاص بها.

---

## 🔗 تفعيل بيانات الطيران الحقيقية (Amadeus) — 5 دقائق

حالياً يعمل محرك محاكاة داخلي يولّد نتائج واقعية بأسعار MAD. لتصل برحلات حقيقية:

1. سجّل مجاناً في [developers.amadeus.com](https://developers.amadeus.com) (Self-Service).
2. أنشئ تطبيقاً جديداً → انسخ **API Key** و **API Secret**.
3. ضعهما في `.env` (محلياً أو على VPS) أو في متغيرات البيئة على Vercel:
   ```
   AMADEUS_CLIENT_ID=xxxxx
   AMADEUS_CLIENT_SECRET=xxxxx
   ```
4. أعد التشغيل — يتحوّل `/api/health` إلى `flightProvider: "amadeus"` تلقائياً،
   وإذا فشلت المنصة الخارجية في أي لحظة يرجع الموقع للمحرك المحلي دون أن يظهر خطأ للزائر.
5. **بيئة الاختبار vs الإنتاج:** المفاتيح المجانية تعمل على `test.api.amadeus.com` (نتائج تجريبية واقعية).
   عند طلب الإنتاج الفعلي (Real Bookings) من أماديوس وأخذ الموافقة، أضف:
   `AMADEUS_HOSTNAME=production` — يتحول السيرفر إلى `api.amadeus.com` تلقائياً بلا أي تغيير كود.

> بيئة الاختبار المجانية تعطي طلبات محدودة (شهرية) — كافية للتجربة والتطوير.

---

## 🛡️ ما الذي يؤمّن السيرفر فعلاً؟

| الحماية | التفصيل |
|---|---|
| تحقق المدخلات | مخططات Zod صارمة على كل POST (نوع، طول، بريد، أرقام) |
| حد الطلب | 15-60 طلب/دقيقة لكل IP حسب المسار، وقفل 8 محاولات دخول خاطئة/10 د |
| كلمات السر | scrypt (نفس عائلة bcrypt) بملح عشوائي لكل مستخدم |
| الجلسات | توكن HMAC-SHA256 موقّع + مدة صلاحية 30 يوماً |
| خصوصية الحجوزات | لا تُعطى قائمة حجوزات أي بريد إلا لصاحبه (جهاز مطابق أو توكن) |
| تنقية المحتوى | تنظيف نصوص حرّة من الوسوم وأحرف التحكم قبل التخزين |
| ترويسات أمنية | nosniff + SAMEORIGIN + Referrer-Policy + CSP داخل كل صفحة |

## استكشاف الأخطاء

| العَرَض | السبب والحل |
|---|---|
| الموقع يفتح لكن «وضع محلي» | افتح `/api/health` — إن لم يرد فالسيرفر متوقف؛ راجع لوج المنصة |
| `db error` عند الحجز | `DATABASE_URL` خاطئ أو لم تُنفَّذ `bun run db:push` |
| 423 عند الدخول | قفل المحاولات — انتظر 10 دقائق أو صفّر جدول LoginAttempt |
| HTTPS لا يعمل على VPS | تأكد أن DNS يشير للسيرفر قبل تشغيل Caddy |
