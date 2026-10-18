import type { NextConfig } from "next";

/* رحلتي — إعداد السيرفر
   - الموقع الساكن (public/*.html) يُخدم كما هو، والمسار الرئيسي / يعرض index.html
   - API تحت /api/* (بحث + حجوزات + حسابات)
   - ترويسات أمنية موحدة لكل الاستجابات (الصفحات تحمل meta CSP خاصاً بها) */
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // لا كاش لأي استجابة API — بيانات حيّة
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
