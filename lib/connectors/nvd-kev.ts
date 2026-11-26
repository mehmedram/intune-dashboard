import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchJson } from './http'
import type { ConnectorResult } from './types'

type NvdMetric = { cvssData: { baseScore: number; vectorString: string; version: string; baseSeverity?: string }; baseSeverity?: string }
type NvdResponse = {
  vulnerabilities: {
    cve: {
      id: string
      published: string
      lastModified: string
      descriptions: { lang: string; value: string }[]
      metrics?: { cvssMetricV40?: NvdMetric[]; cvssMetricV31?: NvdMetric[]; cvssMetricV30?: NvdMetric[] }
    }
  }[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function syncNvd(db: SupabaseClient, orgId: string, batchSize: number): Promise<ConnectorResult> {
  const apiKey = process.env.NVD_API_KEY
  const limit = Math.min(Math.max(batchSize, 1), apiKey ? 50 : 5)
  const staleBefore = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const { data: pending } = await db
    .from('cve_records')
    .select('id, cve_id')
    .eq('organization_id', orgId)
    .or(`nvd_synced_at.is.null,nvd_synced_at.lt.${staleBefore}`)
    .order('nvd_synced_at', { ascending: true, nullsFirst: true })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  let updated = 0
  let attempts = 0
  for (const [i, row] of (pending ?? []).entries()) {
    if (i > 0) await sleep(apiKey ? 700 : 6500)
    const { data, attempts: a } = await fetchJson<NvdResponse>(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(row.cve_id)}`, {
      headers: apiKey ? { apiKey } : {},
    })
    attempts += a
    const cve = data.vulnerabilities[0]?.cve
    const now = new Date().toISOString()
    if (!cve) {
      await db.from('cve_records').update({ nvd_synced_at: now }).eq('id', row.id)
      continue
    }
    const m = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0] ?? cve.metrics?.cvssMetricV40?.[0]
    const sev = (m?.cvssData.baseSeverity ?? m?.baseSeverity)?.toLowerCase()
    await db
      .from('cve_records')
      .update({
        description: cve.descriptions.find((d) => d.lang === 'en')?.value ?? null,
        published_at: cve.published,
        last_modified_at: cve.lastModified,
        ...(m
          ? {
              cvss_score: m.cvssData.baseScore,
              cvss_vector: m.cvssData.vectorString,
              cvss_version: m.cvssData.version,
              severity: sev && ['critical', 'high', 'medium', 'low', 'none'].includes(sev) ? sev : 'unknown',
            }
          : {}),
        nvd_synced_at: now,
        updated_at: now,
      })
      .eq('id', row.id)
    updated++
  }
  return { found: pending?.length ?? 0, created: 0, updated, attempts, note: apiKey ? undefined : 'Running without NVD_API_KEY (5 CVEs per run).' }
}

type KevCatalog = {
  vulnerabilities: {
    cveID: string
    vendorProject: string
    product: string
    vulnerabilityName: string
    dateAdded: string
    shortDescription: string
    requiredAction: string
    dueDate: string
    knownRansomwareCampaignUse: string
  }[]
}

export async function syncKev(db: SupabaseClient, orgId: string): Promise<ConnectorResult> {
  const { data, attempts } = await fetchJson<KevCatalog>('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', { timeoutMs: 60000 })
  const ms = data.vulnerabilities.filter((v) => v.vendorProject.toLowerCase() === 'microsoft')
  const ids = ms.map((v) => v.cveID)

  const existing = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data: rows } = await db.from('cve_records').select('cve_id').eq('organization_id', orgId).in('cve_id', ids.slice(i, i + 500))
    rows?.forEach((r) => existing.add(r.cve_id))
  }

  const now = new Date().toISOString()
  const rows = ms.map((v) => ({
    organization_id: orgId,
    cve_id: v.cveID,
    ...(existing.has(v.cveID) ? {} : { title: v.vulnerabilityName, description: v.shortDescription }),
    cisa_kev: true,
    exploitation_status: 'exploited',
    kev_date_added: v.dateAdded,
    kev_due_date: v.dueDate,
    kev_required_action: v.requiredAction,
    kev_ransomware_use: v.knownRansomwareCampaignUse,
    kev_synced_at: now,
    updated_at: now,
  }))

  for (let i = 0; i < rows.length; i += 300) {
    // Upsert per uniform key-set to avoid nulling columns PostgREST would default for missing keys.
    const chunk = rows.slice(i, i + 300)
    const fresh = chunk.filter((r) => !existing.has(r.cve_id))
    const known = chunk.filter((r) => existing.has(r.cve_id))
    if (fresh.length) {
      const { error } = await db.from('cve_records').upsert(fresh, { onConflict: 'organization_id,cve_id' })
      if (error) throw new Error(`Saving KEV entries: ${error.message}`)
    }
    if (known.length) {
      const { error } = await db.from('cve_records').upsert(known, { onConflict: 'organization_id,cve_id' })
      if (error) throw new Error(`Saving KEV entries: ${error.message}`)
    }
  }
  return { found: ms.length, created: rows.length - existing.size, updated: existing.size, attempts }
}
