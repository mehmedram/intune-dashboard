import 'server-only'

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fetchJson<T>(url: string, init: RequestInit & { retries?: number; timeoutMs?: number } = {}): Promise<{ data: T; attempts: number }> {
  const { retries = 3, timeoutMs = 30000, ...rest } = init
  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { Accept: 'application/json', 'User-Agent': 'PatchIntel/1.0', ...(rest.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after'))
        throw Object.assign(new Error(`HTTP ${res.status} from ${new URL(url).host}`), { retryAfter: Number.isFinite(retryAfter) ? retryAfter * 1000 : 0 })
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const err = new Error(`HTTP ${res.status} from ${new URL(url).host}: ${body.slice(0, 300)}`)
        ;(err as Error & { fatal: boolean }).fatal = true
        throw err
      }
      return { data: (await res.json()) as T, attempts: attempt }
    } catch (e) {
      lastError = e
      if ((e as { fatal?: boolean }).fatal || attempt === retries) break
      const wait = (e as { retryAfter?: number }).retryAfter || 1000 * 2 ** (attempt - 1) + Math.random() * 500
      await sleep(Math.min(wait, 15000))
    }
  }
  throw lastError
}

export function graphConfig() {
  const tenantId = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) return null
  return { tenantId, clientId, clientSecret }
}

let tokenCache: { token: string; expires: number } | null = null

export async function getGraphAppToken() {
  const cfg = graphConfig()
  if (!cfg) throw new ConfigurationError('Microsoft Entra app credentials (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET) are not configured.')
  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.token
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !json.access_token) throw new Error(`Microsoft identity platform: ${json.error_description?.split('\r\n')[0] ?? `HTTP ${res.status}`}`)
  tokenCache = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return json.access_token
}

export async function graphGetAll<T>(url: string, maxPages = 10) {
  const token = await getGraphAppToken()
  const items: T[] = []
  let next: string | undefined = url
  let attempts = 0
  for (let i = 0; next && i < maxPages; i++) {
    const { data, attempts: a }: { data: { value: T[]; '@odata.nextLink'?: string }; attempts: number } = await fetchJson(next, {
      headers: { Authorization: `Bearer ${token}` },
    })
    attempts += a
    items.push(...data.value)
    next = data['@odata.nextLink']
  }
  return { items, attempts }
}
