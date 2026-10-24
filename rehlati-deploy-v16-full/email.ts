/* رحلتي — البريد الإلكتروني (v1.4)
   ─────────────────────────────────────────────────────────────────────────────
   إرسال تأكيد الحجوزات عبر Resend (resend.com) — fetch مباشر، بلا أي اعتمادية
   جديدة في package.json (لا nodemailer ولا SDK — فقط fetch مدمج في Node 18+).

   متغيرات البيئة (على Vercel: Settings → Environment Variables):
     RESEND_API_KEY   مفتاح من resend.com — بدونه: لا إرسال ولا أي خطأ،
                      والموقع يعمل تماماً كما كان. الميزة تُفعَّل بالمفتاح فقط.
     MAIL_FROM        المُرسِل الظاهر في بريد العميل.
                      افتراضي: "رحلتي <onboarding@resend.dev>"
                      ⚠️ onboarding@resend.dev يوصل فقط إلى بريد صاحب حساب
                         Resend (مثالي للتجربة). للإرسال إلى أي عميل: تحقّق من
                         نطاقك في Resend → Domains ثم اجعل القيمة مثلاً:
                         "رحلتي <bookings@nawbatik.com>"
     SITE_URL         رابط الموقع لأزرار البريد (افتراضي: موقع Vercel المنشور)
   ───────────────────────────────────────────────────────────────────────────── */

export type BookingEmailData = {
  ref: string
  type: 'flight' | 'hotel' | 'package'
  email: string
  title: string
  totalMad: number
  cur: string
  lang: 'ar' | 'en'
  visa: boolean
  createdAt: Date
  payload: Record<string, unknown>
}

const SITE_URL = (process.env.SITE_URL || 'https://rehlati-v16.vercel.app').replace(/\/+$/, '')

/** هل البريد مفعّل؟ (يظهر في /api/health) */
export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY
}

/** إرسال تأكيد حجز — fire-and-forget: لا يرمي خطأً أبداً ولا يُبطئ استجابة الحجز */
export function sendBookingConfirmation(b: BookingEmailData): void {
  const key = process.env.RESEND_API_KEY
  if (!key) return // بلا مفتاح: الميزة موقوفة بصمت — سلوك الموقع كما كان تماماً
  try {
    const { subject, html } = renderBookingEmail(b)
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'رحلتي <onboarding@resend.dev>',
        to: [b.email],
        subject,
        html,
      }),
    })
      .then(async (r) => {
        if (r.ok) console.log(`[email] ✓ تأكيد ${b.ref} أُرسل إلى ${b.email}`)
        else console.warn(`[email] ✗ ${b.ref} status=${r.status}`, (await r.text()).slice(0, 300))
      })
      .catch((e) => console.warn('[email] network error:', (e as Error)?.message || e))
  } catch (e) {
    console.warn('[email] render error:', (e as Error)?.message || e)
  }
}

/* ═════════════════════════ القالب ═════════════════════════ */

type Lang = 'ar' | 'en'

const T = {
  ar: {
    badge: 'تم تأكيد الحجز',
    hello: 'مرحباً 👋',
    intro: 'حجزك جاهز ومؤكَّد في نظام رحلتي. احتفظ برقم المرجع أدناه — يُطلب في أي استفسار:',
    refLabel: 'رقم المرجع',
    details: 'تفاصيل الحجز',
    total: 'الإجمالي (شامل الرسوم)',
    visaYes: 'طلب مستند تأشيرة: نعم — أصدر مستند PDF من صفحة الحجز',
    visaNo: 'طلب مستند تأشيرة: لا',
    cta: 'عرض رحلاتي في الموقع',
    tip: 'نصيحة: يمكنك دائماً العودة إلى صفحة «رحلتي» في الموقع لعرض أو تحميل مستند الحجز في أي وقت.',
    footer: 'رسالة تلقائية أُرسلت لحظة تأكيد الحجز على موقع رحلتي — لا تردّ عليها.',
    airline: 'شركة الطيران',
    flightNo: 'رقم الرحلة',
    from: 'من',
    to: 'إلى',
    depart: 'تاريخ المغادرة',
    ret: 'تاريخ العودة',
    pax: 'المسافرون',
    cls: 'درجة السفر',
    hotel: 'الفندق',
    hotelTel: 'هاتف الفندق',
    city: 'المدينة',
    checkin: 'تسجيل الوصول',
    checkout: 'تسجيل المغادرة',
    nights: 'عدد الليالي',
    rooms: 'الغرف',
    roomType: 'نوع الغرفة',
    pkg: 'الباقة',
    persons: 'عدد الأشخاص',
    oneWay: 'ذهاب فقط',
  },
  en: {
    badge: 'Booking confirmed',
    hello: 'Hello 👋',
    intro: 'Your booking is confirmed in the Rehlati system. Keep the reference below — it is required for any inquiry:',
    refLabel: 'Reference',
    details: 'Booking details',
    total: 'Total (incl. fees)',
    visaYes: 'Visa document requested: Yes — issue the PDF from the booking page',
    visaNo: 'Visa document requested: No',
    cta: 'View my trips on the website',
    tip: 'Tip: you can always go back to the “My Trips” page to view or download your booking document.',
    footer: 'Automatic message sent the moment your booking was confirmed on Rehlati — do not reply.',
    airline: 'Airline',
    flightNo: 'Flight number',
    from: 'From',
    to: 'To',
    depart: 'Departure date',
    ret: 'Return date',
    pax: 'Passengers',
    cls: 'Cabin class',
    hotel: 'Hotel',
    hotelTel: 'Hotel phone',
    city: 'City',
    checkin: 'Check-in',
    checkout: 'Check-out',
    nights: 'Nights',
    rooms: 'Rooms',
    roomType: 'Room type',
    pkg: 'Package',
    persons: 'Persons',
    oneWay: 'One-way',
  },
} as const

const TYPE_LABEL: Record<BookingEmailData['type'], Record<Lang, string>> = {
  flight: { ar: 'تذكرة طيران', en: 'Flight' },
  hotel: { ar: 'حجز فندق', en: 'Hotel' },
  package: { ar: 'باقة سفر', en: 'Package' },
}

const CLS_LABEL: Record<string, Record<Lang, string>> = {
  economy: { ar: 'اقتصادي', en: 'Economy' },
  business: { ar: 'أعمال', en: 'Business' },
  first: { ar: 'أولى', en: 'First' },
}

/** تهريب HTML — كل قيمة قادمة من payload تمر من هنا (الحماية أولاً) */
function esc(v: unknown): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(n: number, cur: string): string {
  const v = Number.isFinite(n) ? n : 0
  return `${v.toLocaleString('en-US')} ${esc(cur || 'MAD')}`
}

type Row = { label: string; value: string }

function rowsFor(b: BookingEmailData, t: (typeof T)['ar'] | (typeof T)['en']): Row[] {
  const p = (b.payload || {}) as Record<string, unknown>
  const s = (k: string): string | null => {
    const v = p[k]
    if (v === undefined || v === null || v === '') return null
    return esc(v)
  }
  const num = (k: string): number | null => {
    const v = Number(p[k])
    return Number.isFinite(v) ? v : null
  }
  const rows: Row[] = []

  if (b.type === 'flight') {
    const cls = typeof p.cls === 'string' ? CLS_LABEL[p.cls]?.[b.lang] || esc(p.cls) : null
    const d2 = s('d2')
    rows.push(
      { label: t.airline, value: s('airline') || '—' },
      { label: t.flightNo, value: s('no') || '—' },
      { label: t.from, value: s('from') || '—' },
      { label: t.to, value: s('to') || '—' },
      { label: t.depart, value: s('d1') || '—' },
      ...(d2 ? [{ label: t.ret, value: d2 }] : [{ label: t.ret, value: t.oneWay }]),
      { label: t.pax, value: num('pax') !== null ? String(num('pax')) : '—' },
      ...(cls ? [{ label: t.cls, value: cls }] : []),
    )
  } else if (b.type === 'hotel') {
    const ni = num('ni')
    const rm = num('rm')
    rows.push(
      { label: t.hotel, value: s('hotel') || '—' },
      ...(s('tel') ? [{ label: t.hotelTel, value: s('tel') as string }] : []),
      { label: t.city, value: s('city') || '—' },
      { label: t.checkin, value: s('ci') || '—' },
      { label: t.checkout, value: s('co') || '—' },
      { label: t.nights, value: ni !== null ? String(ni) : '—' },
      { label: t.rooms, value: rm !== null ? String(rm) : '—' },
      ...(s('room') ? [{ label: t.roomType, value: s('room') as string }] : []),
    )
  } else {
    rows.push(
      { label: t.pkg, value: s('title') || b.title || '—' },
      { label: t.city, value: s('city') || '—' },
      { label: t.depart, value: s('d1') || '—' },
      { label: t.ret, value: s('d2') || '—' },
      { label: t.persons, value: num('px') !== null ? String(num('px')) : '—' },
    )
  }
  return rows
}

function renderBookingEmail(b: BookingEmailData): { subject: string; html: string } {
  const lang: Lang = b.lang === 'en' ? 'en' : 'ar'
  const t = T[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const align = lang === 'ar' ? 'right' : 'left'
  const rows = rowsFor(b, t)

  const subject =
    lang === 'ar'
      ? `تأكيد الحجز ${b.ref} — رحلتي`
      : `Booking ${b.ref} confirmed — Rehlati`

  const rowHtml = rows
    .map(
      (r, i) => `
      <tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'};">
        <td style="padding:10px 16px;font-size:13px;color:#64748b;white-space:nowrap;">${esc(r.label)}</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#0f172a;text-align:${align};">${r.value}</td>
      </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<body style="margin:0;padding:0;background:#eef2f7;font-family:Tahoma,Arial,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.08);">

        <!-- الترويسة -->
        <tr><td style="background:#0f172a;padding:26px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.5px;">رحلتي <span style="color:#38bdf8;">|</span> REHLATI</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:6px;">${lang === 'ar' ? 'رحلاتك تبدأ من هنا' : 'Your journey starts here'}</div>
        </td></tr>

        <!-- شارة التأكيد -->
        <tr><td style="padding:26px 24px 0 24px;" align="center">
          <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:13px;font-weight:700;padding:7px 18px;border-radius:999px;">✓ ${esc(t.badge)}</span>
          <h1 style="margin:16px 0 4px;font-size:20px;color:#0f172a;text-align:${align};">${esc(t.hello)}</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;text-align:${align};">${esc(t.intro)}</p>
        </td></tr>

        <!-- صندوق المرجع -->
        <tr><td style="padding:18px 24px 4px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed #38bdf8;background:#f0f9ff;border-radius:10px;">
            <tr><td style="padding:14px;text-align:center;">
              <div style="font-size:11px;color:#0369a1;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${esc(t.refLabel)}</div>
              <div style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:2px;font-family:'Courier New',monospace;margin-top:4px;">${esc(b.ref)}</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- التفاصيل -->
        <tr><td style="padding:18px 24px 0 24px;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:8px;">${esc(t.details)} — ${esc(TYPE_LABEL[b.type][lang])}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            ${rowHtml}
            <tr style="background:#0f172a;">
              <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#e2e8f0;">${esc(t.total)}</td>
              <td style="padding:12px 16px;font-size:16px;font-weight:800;color:#38bdf8;text-align:${align};">${money(b.totalMad, b.cur)}</td>
            </tr>
          </table>
        </td></tr>

        <!-- ملاحظة التأشيرة -->
        ${b.visa ? `<tr><td style="padding:14px 24px 0 24px;">
          <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:10px 14px;font-size:12.5px;color:#854d0e;line-height:1.6;">📄 ${esc(t.visaYes)}</div>
        </td></tr>` : ''}

        <!-- الزر -->
        <tr><td style="padding:22px 24px 4px 24px;" align="center">
          <a href="${SITE_URL}/my-trips.html?lang=${lang}"
             style="display:inline-block;background:#0284c7;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 34px;border-radius:10px;">${esc(t.cta)}</a>
        </td></tr>

        <!-- نصيحة -->
        <tr><td style="padding:14px 24px 0 24px;">
          <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:${align};">${esc(t.tip)}</p>
        </td></tr>

        <!-- التذييل -->
        <tr><td style="padding:20px 24px 22px 24px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:11px;color:#94a3b8;text-align:center;line-height:1.7;">
            ${esc(t.footer)}<br>
            <a href="${SITE_URL}" style="color:#0284c7;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
