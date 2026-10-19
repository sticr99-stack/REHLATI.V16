/* رحلتي — الصفحة الرئيسية
   المسار / يُعاد توجيهه عبر next.config إلى /index.html (موقع رحلتي الساكن).
   هذه الصفحة شبكة أمان فقط إن لم يعمل إعادة التوجيه لأي سبب. */

export default function Home() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta httpEquiv="refresh" content="0; url=/index.html" />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f172a", color: "#fff" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 20, fontWeight: 700 }}>رحلتي | Rehlati</p>
          <a href="/index.html" style={{ color: "#60a5fa", fontSize: 14 }}>
            إذا لم يتم التحويل تلقائياً — اضغط هنا للدخول إلى الموقع
          </a>
          <a href="/api/health" style={{ color: "#94a3b8", fontSize: 12 }}>
            حالة السيرفر (API)
          </a>
        </div>
      </body>
    </html>
  );
}
