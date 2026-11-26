import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConfigurationError } from './http'
import { syncMsrc } from './msrc'
import { syncNvd, syncKev } from './nvd-kev'
import { syncMessageCenter, syncServiceHealth, syncWindowsReleaseHealth, syncUpdateCatalog } from './graph'
import type { ConnectorResult } from './types'

type Source = {
  id: string
  organization_id: string
  key: string
  enabled: boolean
  interval_minutes: number
  config: Record<string, unknown>
  consecutive_failures: number
  records_total: number
}

const STALE_LOCK_MS = 15 * 60 * 1000

export async function runSource(sourceId: string, trigger: 'schedule' | 'manual' | 'retry', userId?: string) {
  const db = createAdminClient()
  const { data: src } = await db.from('update_sources').select('*').eq('id', sourceId).single<Source & { status: string; last_attempt_at: string | null }>()
  if (!src) throw new Error('Source not found')

  if (src.status === 'running' && src.last_attempt_at && Date.now() - new Date(src.last_attempt_at).getTime() < STALE_LOCK_MS) {
    return { status: 'skipped' as const, message: 'A synchronization is already running for this source.' }
  }

  const { data: settings } = await db.from('application_settings').select('nvd_batch_size').eq('organization_id', src.organization_id).maybeSingle()
  const startedAt = new Date().toISOString()
  await db.from('update_sources').update({ status: 'running', last_attempt_at: startedAt }).eq('id', src.id)
  const { data: log } = await db
    .from('source_sync_logs')
    .insert({ organization_id: src.organization_id, source_id: src.id, trigger, triggered_by: userId ?? null, status: 'running' })
    .select('id')
    .single()

  try {
    let result: ConnectorResult
    switch (src.key) {
      case 'msrc':
        result = await syncMsrc(db, src.organization_id, src.id, src.config as { months?: number })
        break
      case 'nvd':
        result = await syncNvd(db, src.organization_id, settings?.nvd_batch_size ?? 20)
        break
      case 'cisa_kev':
        result = await syncKev(db, src.organization_id)
        break
      case 'graph_message_center':
        result = await syncMessageCenter(db, src.organization_id, src.id)
        break
      case 'graph_service_health':
        result = await syncServiceHealth(db, src.organization_id, src.id)
        break
      case 'windows_release_health':
        result = await syncWindowsReleaseHealth(db, src.organization_id, src.id)
        break
      case 'update_catalog':
        result = await syncUpdateCatalog(db, src.organization_id)
        break
      default:
        throw new ConfigurationError(`No connector is implemented for "${src.key}".`)
    }

    const finished = new Date().toISOString()
    await db
      .from('source_sync_logs')
      .update({
        status: 'success',
        finished_at: finished,
        records_found: result.found,
        records_created: result.created,
        records_updated: result.updated,
        attempts: Math.max(result.attempts, 1),
        error: result.note ?? null,
      })
      .eq('id', log!.id)
    await db
      .from('update_sources')
      .update({
        status: 'ok',
        last_success_at: finished,
        last_error: null,
        consecutive_failures: 0,
        records_total: src.records_total + result.created,
        next_run_at: new Date(Date.now() + src.interval_minutes * 60000).toISOString(),
      })
      .eq('id', src.id)
    return { status: 'success' as const, message: `Found ${result.found}, created ${result.created}, refreshed ${result.updated}.`, result }
  } catch (e) {
    const isConfig = e instanceof ConfigurationError
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000)
    const failures = src.consecutive_failures + 1
    const backoffMin = isConfig ? 24 * 60 : Math.min(src.interval_minutes, 15 * 2 ** Math.min(failures - 1, 6))
    await db.from('source_sync_logs').update({ status: 'error', finished_at: new Date().toISOString(), error: message }).eq('id', log!.id)
    await db
      .from('update_sources')
      .update({
        status: isConfig ? 'needs_configuration' : 'error',
        last_error: message,
        consecutive_failures: failures,
        next_run_at: new Date(Date.now() + backoffMin * 60000).toISOString(),
      })
      .eq('id', src.id)
    return { status: 'error' as const, message }
  }
}

export async function runDueSources(limit = 5) {
  const db = createAdminClient()
  const { data: due } = await db
    .from('update_sources')
    .select('id')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .neq('status', 'running')
    .order('next_run_at')
    .limit(limit)
  const results = []
  for (const s of due ?? []) results.push({ id: s.id, ...(await runSource(s.id, 'schedule')) })
  return results
}
