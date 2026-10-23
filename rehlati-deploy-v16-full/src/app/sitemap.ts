/* رحلتي — خريطة الموقع لمحركات البحث (تُخدم على /sitemap.xml) */

import type { MetadataRoute } from 'next'

const BASE = 'https://rehlati-v16.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const pages: Array<{ path: string; priority: number; freq: 'daily' | 'weekly' }> = [
    { path: '/', priority: 1, freq: 'daily' },
    { path: '/flight-hotel-search-results.html', priority: 0.9, freq: 'daily' },
    { path: '/flight-booking.html', priority: 0.8, freq: 'weekly' },
    { path: '/hotel-booking.html', priority: 0.8, freq: 'weekly' },
    { path: '/package-booking.html', priority: 0.8, freq: 'weekly' },
    { path: '/my-trips.html', priority: 0.6, freq: 'weekly' },
    { path: '/sign-in.html', priority: 0.4, freq: 'monthly' },
  ]
  return pages.map((p) => ({
    url: `${BASE}${p.path === '/' ? '/' : p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }))
}
