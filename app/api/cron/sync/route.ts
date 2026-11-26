import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { runDueSources } from '@/lib/connectors/run'

export const maxDuration = 300

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const results = await runDueSources(6)
  return NextResponse.json({ ran: results.length, results })
}
