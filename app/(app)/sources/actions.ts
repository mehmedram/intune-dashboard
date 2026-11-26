'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { fail, userError, type ActionResult } from '@/lib/action-result'
import { runSource } from '@/lib/connectors/run'

async function ownedSource(orgId: string, id: string) {
  z.uuid().parse(id)
  const { data } = await createAdminClient().from('update_sources').select('id, key, name').eq('id', id).eq('organization_id', orgId).maybeSingle()
  if (!data) userError('Source not found.')
  return data
}

export async function runSourceNow(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission('sync.run')
    const src = await ownedSource(session.organizationId, id)
    if (!rateLimit(`sync:${session.organizationId}:${id}`, 3, 5 * 60_000)) userError('Too many manual runs for this source. Try again in a few minutes.')
    const res = await runSource(id, 'manual', session.userId)
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'source.sync',
      entityType: 'source',
      entityId: id,
      details: { key: src.key, status: res.status },
    })
    revalidatePath('/sources')
    revalidatePath('/')
    if (res.status === 'error') return { ok: false, error: `${src.name}: ${res.message}` }
    return { ok: true, message: `${src.name}: ${res.message}` }
  } catch (e) {
    return fail(e)
  }
}

const configSchema = z.object({
  enabled: z.boolean(),
  interval_minutes: z.coerce.number().int().min(15).max(10080),
})

export async function saveSourceConfig(id: string, _: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission('integrations.manage')
    const src = await ownedSource(session.organizationId, id)
    const input = configSchema.parse({ enabled: fd.get('enabled') === 'on', interval_minutes: fd.get('interval_minutes') })
    const { error } = await createAdminClient()
      .from('update_sources')
      .update({
        ...input,
        status: input.enabled ? 'never_run' : 'disabled',
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'source.configure',
      entityType: 'source',
      entityId: id,
      details: { key: src.key, ...input },
    })
    revalidatePath('/sources')
    return { ok: true, message: `${src.name} settings saved.` }
  } catch (e) {
    return fail(e)
  }
}
