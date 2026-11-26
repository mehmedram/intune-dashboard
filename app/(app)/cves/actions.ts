'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/audit'
import { fail, emptyToNull, type ActionResult } from '@/lib/action-result'
import { toPlainText } from '@/lib/sanitize'
import { EXPOSURE, REMEDIATION } from '@/lib/constants'

const schema = z.object({
  exposure_status: z.enum(Object.keys(EXPOSURE) as [string, ...string[]]),
  remediation_status: z.enum(Object.keys(REMEDIATION) as [string, ...string[]]),
  security_notes: z.string().max(20000).nullable(),
})

export async function saveCveAssessment(id: string, _: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission('cves.write')
    z.uuid().parse(id)
    const input = schema.parse({
      exposure_status: emptyToNull(fd.get('exposure_status')) ?? 'not_assessed',
      remediation_status: emptyToNull(fd.get('remediation_status')) ?? 'open',
      security_notes: emptyToNull(fd.get('security_notes')),
    })
    const supabase = await createClient()
    const { error } = await supabase
      .from('cve_records')
      .update({ ...input, security_notes: toPlainText(input.security_notes), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'cve.assess',
      entityType: 'cve',
      entityId: id,
      details: { exposure: input.exposure_status, remediation: input.remediation_status },
    })
    revalidatePath(`/cves/${id}`)
    return { ok: true, message: 'Vulnerability assessment saved.' }
  } catch (e) {
    return fail(e)
  }
}
