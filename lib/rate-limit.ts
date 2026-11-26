import 'server-only'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/**
 * Fixed-window limiter kept per server instance. It blunts bursts from a single
 * user or IP; the database idempotency keys remain the authoritative guard for sends.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) return { ok: false, retryAfterMs: bucket.resetAt - now }
  bucket.count += 1
  return { ok: true, retryAfterMs: 0 }
}
