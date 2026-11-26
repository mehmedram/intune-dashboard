import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEntry = {
  organizationId: string
  userId?: string | null
  userEmail?: string | null
  action: string
  entityType?: string
  entityId?: string | null
  details?: Record<string, unknown>
}

export async function writeAudit(entry: AuditEntry) {
  const admin = createAdminClient()
  const { error } = await admin.from('audit_logs').insert({
    organization_id: entry.organizationId,
    user_id: entry.userId ?? null,
    user_email: entry.userEmail ?? null,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    details: entry.details ?? {},
  })
  if (error) console.error('[audit] failed to write audit log', error.message)
}
