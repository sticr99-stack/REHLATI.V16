/* رحلتي — فحص صحة السيرفر */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { amadeusEnabled } from '@/lib/amadeus'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbOk = true
  try {
    await db.booking.count()
  } catch {
    dbOk = false
  }
  return NextResponse.json({
    ok: true,
    service: 'rehlati-api',
    version: '1.0.0',
    db: dbOk ? 'up' : 'down',
    flightProvider: amadeusEnabled ? 'amadeus' : 'mock',
    time: new Date().toISOString(),
  })
}
