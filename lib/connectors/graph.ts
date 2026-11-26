import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { graphGetAll } from './http'
import type { ConnectorResult } from './types'

type Product = { id: string; name: string; category: string; match_keywords: string[] }

async function loadMatcher(db: SupabaseClient, orgId: string) {
  const { data } = await db.from('products').select('id, name, category, match_keywords').eq('organization_id', orgId).eq('is_active', true)
  const products = (data ?? []) as Product[]
  return (text: string) => products.find((p) => [p.name, ...(p.match_keywords ?? [])].some((k) => text.toLowerCase().includes(k.toLowerCase())))
}

function stripTags(s?: string | null) {
  return (s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000) || null
}

async function insertNew(db: SupabaseClient, orgId: string, sourceType: string, rows: (Record<string, unknown> & { external_id: string })[]) {
  if (rows.length === 0) return { created: 0, updated: 0 }
  const now = new Date().toISOString()
  const ids = rows.map((r) => r.external_id)
  const { data: existing } = await db.from('update_records').select('id, external_id').eq('organization_id', orgId).eq('source_type', sourceType).in('external_id', ids)
  const known = new Set((existing ?? []).map((e) => e.external_id))
  const fresh = rows.filter((r) => !known.has(r.external_id)).map((r) => ({ ...r, original_values: r, last_retrieved_at: now }))
  if (fresh.length) {
    const { error } = await db.from('update_records').insert(fresh)
    if (error) throw new Error(`Saving ${sourceType} records: ${error.message}`)
  }
  if (existing?.length) {
    await db.from('update_records').update({ last_retrieved_at: now }).in('id', existing.map((e) => e.id))
  }
  return { created: fresh.length, updated: existing?.length ?? 0 }
}

type MessageCenterPost = {
  id: string
  title: string
  category: 'preventOrFixIssue' | 'planForChange' | 'stayInformed'
  severity: 'normal' | 'high' | 'critical'
  services: string[]
  startDateTime: string
  actionRequiredByDateTime: string | null
  isMajorChange: boolean
  body: { content: string }
  tags: string[]
}

export async function syncMessageCenter(db: SupabaseClient, orgId: string, sourceId: string): Promise<ConnectorResult> {
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const { items, attempts } = await graphGetAll<MessageCenterPost>(
    `https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/messages?$filter=lastModifiedDateTime ge ${since}&$top=100`,
  )
  const match = await loadMatcher(db, orgId)
  const rows = items.map((m) => {
    const product = match(`${m.services.join(' ')} ${m.title}`)
    const retirement = m.tags?.some((t) => /retire/i.test(t))
    return {
      organization_id: orgId,
      source_type: 'graph_message_center',
      source_id: sourceId,
      external_id: m.id,
      title: `${m.id}: ${m.title}`,
      release_date: m.startDateTime?.slice(0, 10) ?? null,
      classification: retirement ? 'feature_retirement' : m.category === 'planForChange' ? 'product_lifecycle_change' : 'service_announcement',
      severity: m.severity === 'critical' ? 'critical' : m.severity === 'high' || m.isMajorChange ? 'important' : 'informational',
      description: stripTags(m.body?.content),
      deployment_recommendation: m.actionRequiredByDateTime ? `Action required by ${m.actionRequiredByDateTime.slice(0, 10)}` : null,
      product_id: product?.id ?? null,
      product_name: product?.name ?? m.services[0] ?? null,
      product_category: product?.category ?? 'Microsoft 365',
      source_url: `https://admin.microsoft.com/adminportal/home#/MessageCenter/:/messages/${m.id}`,
      verification_status: 'verified',
    }
  })
  const { created, updated } = await insertNew(db, orgId, 'graph_message_center', rows)
  return { found: items.length, created, updated, attempts }
}

type ServiceIssue = {
  id: string
  title: string
  service: string
  classification: 'advisory' | 'incident'
  status: string
  isResolved: boolean
  startDateTime: string
  impactDescription: string
  feature?: string
}

export async function syncServiceHealth(db: SupabaseClient, orgId: string, sourceId: string): Promise<ConnectorResult> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const { items, attempts } = await graphGetAll<ServiceIssue>(
    `https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/issues?$filter=lastModifiedDateTime ge ${since}&$top=100`,
  )
  const match = await loadMatcher(db, orgId)
  const rows = items.map((i) => {
    const product = match(`${i.service} ${i.title}`)
    return {
      organization_id: orgId,
      source_type: 'graph_service_health',
      source_id: sourceId,
      external_id: i.id,
      title: `${i.id}: ${i.title}`,
      release_date: i.startDateTime?.slice(0, 10) ?? null,
      classification: 'service_announcement',
      severity: i.classification === 'incident' && !i.isResolved ? 'important' : 'moderate',
      description: i.impactDescription,
      user_impact: i.impactDescription,
      known_issues: `Status: ${i.status}${i.feature ? ` · Feature: ${i.feature}` : ''}`,
      product_id: product?.id ?? null,
      product_name: product?.name ?? i.service,
      product_category: product?.category ?? 'Microsoft 365',
      source_url: `https://admin.microsoft.com/adminportal/home#/servicehealth/:/alerts/${i.id}`,
      verification_status: 'verified',
    }
  })
  const { created, updated } = await insertNew(db, orgId, 'graph_service_health', rows)
  return { found: items.length, created, updated, attempts }
}

type KnownIssue = {
  id: string
  title: string
  description: string
  status: string
  startDateTime: string
  resolvedDateTime: string | null
  webViewUrl: string
  originatingKnowledgeBaseArticle?: { id: string } | null
  resolvingKnowledgeBaseArticle?: { id: string } | null
}
type WinProduct = { id: string; name: string; knownIssues?: KnownIssue[] }

export async function syncWindowsReleaseHealth(db: SupabaseClient, orgId: string, sourceId: string): Promise<ConnectorResult> {
  const { items, attempts } = await graphGetAll<WinProduct>(
    `https://graph.microsoft.com/beta/admin/windows/updates/products?$expand=knownIssues($filter=status eq 'active')`,
    5,
  )
  const match = await loadMatcher(db, orgId)
  const rows = items.flatMap((p) =>
    (p.knownIssues ?? []).map((k) => {
      const product = match(p.name)
      const kb = k.originatingKnowledgeBaseArticle?.id ? `KB${k.originatingKnowledgeBaseArticle.id.replace(/\D/g, '')}` : null
      return {
        organization_id: orgId,
        source_type: 'windows_release_health',
        source_id: sourceId,
        external_id: `${p.id}:${k.id}`,
        title: `Known issue (${p.name}): ${k.title}`,
        kb_number: kb && /^KB\d{5,8}$/.test(kb) ? kb : null,
        release_date: k.startDateTime?.slice(0, 10) ?? null,
        classification: 'other',
        severity: 'moderate',
        known_issues: stripTags(k.description),
        description: stripTags(k.description),
        product_id: product?.id ?? null,
        product_name: product?.name ?? p.name,
        product_category: product?.category ?? 'Windows Client',
        source_url: k.webViewUrl,
        verification_status: 'verified',
      }
    }),
  )
  const { created, updated } = await insertNew(db, orgId, 'windows_release_health', rows)
  return { found: rows.length, created, updated, attempts }
}

export async function syncUpdateCatalog(db: SupabaseClient, orgId: string): Promise<ConnectorResult> {
  const { data } = await db.from('update_records').select('id, kb_number').eq('organization_id', orgId).not('kb_number', 'is', null).is('catalog_url', null).limit(1000)
  for (const r of data ?? []) {
    await db.from('update_records').update({ catalog_url: `https://www.catalog.update.microsoft.com/Search.aspx?q=${r.kb_number}` }).eq('id', r.id)
  }
  return { found: data?.length ?? 0, created: 0, updated: data?.length ?? 0, attempts: 0, note: 'The Update Catalog has no public API; catalog reference links are generated for each KB.' }
}
