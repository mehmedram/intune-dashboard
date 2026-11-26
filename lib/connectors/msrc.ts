import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchJson } from './http'
import type { ConnectorResult } from './types'

type Text = { Value?: string }
type CvrfIndex = { value: { ID: string; InitialReleaseDate: string; CurrentReleaseDate: string }[] }
type Cvrf = {
  DocumentTracking?: { InitialReleaseDate?: string; CurrentReleaseDate?: string }
  ProductTree?: { FullProductName?: { ProductID: string; Value: string }[] }
  Vulnerability?: {
    CVE: string
    Title?: Text
    Notes?: { Title?: string; Type?: number; Value?: string }[]
    Threats?: { Type: number; Description?: Text; ProductID?: string[] }[]
    Remediations?: { Type: number; Description?: Text; URL?: string; ProductID?: string[]; FixedBuild?: string; RestartRequired?: Text; SubType?: string }[]
    CVSSScoreSets?: { BaseScore: number; Vector?: string; ProductID?: string[] }[]
    RevisionHistory?: { Date?: string }[]
  }[]
}

const SEV_RANK: Record<string, number> = { critical: 4, important: 3, moderate: 2, low: 1, informational: 0 }

function cvssSeverity(score: number | null) {
  if (score == null) return 'unknown'
  if (score >= 9) return 'critical'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

function parseExploit(desc?: string) {
  const d = (desc ?? '').toLowerCase()
  if (d.includes('exploited:yes')) return 'exploited'
  if (d.includes('exploitation more likely')) return 'exploitation_more_likely'
  if (d.includes('publicly disclosed:yes')) return 'publicly_disclosed'
  return 'not_known'
}

function stripTags(s?: string) {
  return (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null
}

export async function syncMsrc(db: SupabaseClient, orgId: string, sourceId: string, config: { months?: number }): Promise<ConnectorResult> {
  const months = Math.min(Math.max(config.months ?? 2, 1), 6)
  const { data: index, attempts: a0 } = await fetchJson<CvrfIndex>('https://api.msrc.microsoft.com/cvrf/v3.0/updates')
  let attempts = a0
  const recent = [...index.value].sort((x, y) => y.InitialReleaseDate.localeCompare(x.InitialReleaseDate)).slice(0, months)

  const { data: products } = await db.from('products').select('id, name, category, match_keywords').eq('organization_id', orgId).eq('is_active', true)
  const matchProduct = (name: string) =>
    (products ?? []).find((p) => [p.name, ...(p.match_keywords ?? [])].some((k: string) => name.toLowerCase().includes(k.toLowerCase())))

  let found = 0
  let created = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const doc of recent) {
    const { data: cvrf, attempts: a } = await fetchJson<Cvrf>(`https://api.msrc.microsoft.com/cvrf/v3.0/cvrf/${encodeURIComponent(doc.ID)}`, { timeoutMs: 60000 })
    attempts += a
    const productNames = new Map((cvrf.ProductTree?.FullProductName ?? []).map((p) => [p.ProductID, p.Value]))
    const releaseDate = (cvrf.DocumentTracking?.InitialReleaseDate ?? doc.InitialReleaseDate).slice(0, 10)

    type KbAgg = { kb: string; url: string | null; products: Set<string>; cves: Set<string>; severity: string; reboot: string; build: string | null }
    const kbs = new Map<string, KbAgg>()
    const cveRows: Record<string, unknown>[] = []
    const impactRows: { cve: string; product_name: string; kb_number: string | null; fixed_build: string | null; remediation_url: string | null; product_id: string | null }[] = []

    for (const v of cvrf.Vulnerability ?? []) {
      if (!/^CVE-\d{4}-\d+$/.test(v.CVE)) continue
      found++
      const sevThreat = v.Threats?.find((t) => t.Type === 3)?.Description?.Value ?? null
      const impact = v.Threats?.find((t) => t.Type === 0)?.Description?.Value ?? null
      const exploit = v.Threats?.find((t) => t.Type === 1)?.Description?.Value
      const best = [...(v.CVSSScoreSets ?? [])].sort((x, y) => y.BaseScore - x.BaseScore)[0]
      const description = stripTags(v.Notes?.find((n) => n.Type === 2 || n.Title === 'Description')?.Value)
      cveRows.push({
        organization_id: orgId,
        cve_id: v.CVE,
        title: v.Title?.Value ?? null,
        ms_severity: sevThreat,
        ms_impact: impact,
        exploitation_status: parseExploit(exploit),
        ...(best ? { cvss_score: best.BaseScore, cvss_vector: best.Vector ?? null, cvss_version: best.Vector?.startsWith('CVSS:3.1') ? '3.1' : '3.x', severity: cvssSeverity(best.BaseScore) } : {}),
        ...(description ? { description } : {}),
        published_at: releaseDate,
        advisory_url: `https://msrc.microsoft.com/update-guide/vulnerability/${v.CVE}`,
        msrc_synced_at: now,
        updated_at: now,
      })

      const msSev = (sevThreat ?? 'informational').toLowerCase()
      for (const r of v.Remediations ?? []) {
        if (r.Type !== 2) continue
        const kbDigits = (r.Description?.Value ?? '').match(/^\d{6,8}$/)?.[0]
        const kb = kbDigits ? `KB${kbDigits}` : null
        for (const pid of r.ProductID ?? []) {
          const pname = productNames.get(pid)
          if (!pname) continue
          impactRows.push({ cve: v.CVE, product_name: pname, kb_number: kb, fixed_build: r.FixedBuild ?? null, remediation_url: r.URL ?? null, product_id: matchProduct(pname)?.id ?? null })
          if (!kb) continue
          const agg = kbs.get(kb) ?? { kb, url: r.URL ?? null, products: new Set(), cves: new Set(), severity: 'informational', reboot: 'unknown', build: r.FixedBuild ?? null }
          agg.products.add(pname)
          agg.cves.add(v.CVE)
          if ((SEV_RANK[msSev] ?? 0) > (SEV_RANK[agg.severity] ?? 0)) agg.severity = msSev in SEV_RANK ? msSev : agg.severity
          const restart = r.RestartRequired?.Value?.toLowerCase()
          if (restart === 'yes') agg.reboot = 'yes'
          else if (restart === 'maybe' && agg.reboot !== 'yes') agg.reboot = 'maybe'
          else if (restart === 'no' && agg.reboot === 'unknown') agg.reboot = 'no'
          kbs.set(kb, agg)
        }
      }
    }

    for (let i = 0; i < cveRows.length; i += 200) {
      const { error } = await db.from('cve_records').upsert(cveRows.slice(i, i + 200), { onConflict: 'organization_id,cve_id' })
      if (error) throw new Error(`Saving CVEs: ${error.message}`)
    }
    const { data: cveIds } = await db.from('cve_records').select('id, cve_id').eq('organization_id', orgId).in('cve_id', cveRows.map((c) => c.cve_id as string))
    const cveMap = new Map((cveIds ?? []).map((c) => [c.cve_id, c.id]))

    const dedupImpact = new Map<string, Record<string, unknown>>()
    for (const r of impactRows) {
      const cveId = cveMap.get(r.cve)
      if (!cveId) continue
      dedupImpact.set(`${cveId}|${r.product_name}|${r.kb_number}`, {
        organization_id: orgId, cve_record_id: cveId, product_id: r.product_id, product_name: r.product_name,
        kb_number: r.kb_number, fixed_build: r.fixed_build, remediation_url: r.remediation_url,
      })
    }
    const impactList = [...dedupImpact.values()]
    for (let i = 0; i < impactList.length; i += 500) {
      await db.from('cve_product_impact').upsert(impactList.slice(i, i + 500), { onConflict: 'cve_record_id,product_name,kb_number' })
    }

    const externalIds = [...kbs.keys()].map((k) => `msrc:${k}`)
    const { data: existing } = await db.from('update_records').select('id, external_id').eq('organization_id', orgId).eq('source_type', 'msrc').in('external_id', externalIds)
    const existingMap = new Map((existing ?? []).map((e) => [e.external_id, e.id]))

    for (const agg of kbs.values()) {
      const productList = [...agg.products]
      const primary = productList.map(matchProduct).find(Boolean)
      const externalId = `msrc:${agg.kb}`
      const title = `${agg.kb}: Security update for ${productList[0]}${productList.length > 1 ? ` and ${productList.length - 1} other product(s)` : ''}`
      const sourceFields = {
        title,
        kb_number: agg.kb,
        release_date: releaseDate,
        build_number: agg.build,
        classification: 'security_update',
        severity: agg.severity,
        reboot_required: agg.reboot,
        description: `Security update released ${releaseDate} (${doc.ID}) addressing ${agg.cves.size} CVE(s). Affected products: ${productList.slice(0, 15).join('; ')}${productList.length > 15 ? '…' : ''}`,
        source_url: agg.url ?? `https://support.microsoft.com/help/${agg.kb.slice(2)}`,
        catalog_url: `https://www.catalog.update.microsoft.com/Search.aspx?q=${agg.kb}`,
        last_retrieved_at: now,
      }
      const existingId = existingMap.get(externalId)
      let updateId = existingId
      if (existingId) {
        // Only refresh retrieval metadata on existing records so manual engineer edits are never overwritten.
        await db.from('update_records').update({ last_retrieved_at: now }).eq('id', existingId)
        updated++
      } else {
        const { data: ins, error } = await db
          .from('update_records')
          .insert({
            ...sourceFields,
            organization_id: orgId,
            product_id: primary?.id ?? null,
            product_name: primary?.name ?? productList[0],
            product_category: primary?.category ?? null,
            source_type: 'msrc',
            source_id: sourceId,
            external_id: externalId,
            verification_status: 'verified',
            original_values: sourceFields,
          })
          .select('id')
          .single()
        if (error) throw new Error(`Saving ${agg.kb}: ${error.message}`)
        updateId = ins.id
        created++
      }
      const links = [...agg.cves].map((c) => cveMap.get(c)).filter(Boolean).map((cid) => ({ update_id: updateId, cve_record_id: cid, organization_id: orgId }))
      if (links.length) await db.from('update_cves').upsert(links, { ignoreDuplicates: true })
    }
  }

  return { found, created, updated, attempts }
}
