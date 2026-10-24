/* رحلتي — فحص صحة السيرفر */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { amadeusEnabled } from '@/lib/amadeus'
import { duffelEnabled } from '@/lib/duffel'
import { emailEnabled } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbOk = true
  try {
    await db.booking.count()
  } catch {
    dbOk = false
  }
  const flightProvider = duffelEnabled ? 'duffel' : amadeusEnabled ? 'amadeus' : 'mock'
  return NextResponse.json({
    ok: true,
    service: 'rehlati-api',
    version: '1.5.0',
    db: dbOk ? 'up' : 'down',
    flightProvider,
    email: emailEnabled() ? 'resend' : 'off',
    time: new Date().toISOString(),
  })
}
