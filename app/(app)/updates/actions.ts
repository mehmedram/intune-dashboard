'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { fail, emptyToNull, userError, type ActionResult } from '@/lib/action-result'
import { toPlainText, sanitizeNotes } from '@/lib/sanitize'
import { CLASSIFICATIONS, SEVERITIES, REBOOT, DEPLOYMENT_STATUSES, VERIFICATION, RISK_LEVELS, RECOMMENDATIONS, ENVIRONMENTS, TESTING_RESULTS, ROLLBACK_STATUSES } from '@/lib/constants'

const keys = <T extends Record<string, string>>(m: T) => Object.keys(m) as [keyof T & string, ...(keyof T & string)[]]

const updateSchema = z.object({
  title: z.string().trim().min(3).max(500),
  product_id: z.uuid().nullable(),
  kb_number: z
    .string()
    .trim()
    .regex(/^KB\d{5,8}$/i, 'Use the format KB5031234')
    .transform((v) => v.toUpperCase())
    .nullable(),
  release_date: z.iso.date().nullable(),
  build_number: z.string().max(100).nullable(),
  version: z.string().max(100).nullable(),
  classification: z.enum(keys(CLASSIFICATIONS)),
  severity: z.enum(keys(SEVERITIES)),
  reboot_required: z.enum(keys(REBOOT)),
  deployment_status: z.enum(keys(DEPLOYMENT_STATUSES)),
  verification_status: z.enum(keys(VERIFICATION)),
  description: z.string().max(20000).nullable(),
  known_issues: z.string().max(20000).nullable(),
  prerequisites: z.string().max(10000).nullable(),
  user_impact: z.string().max(10000).nullable(),
  infrastructure_impact: z.string().max(10000).nullable(),
  deployment_recommendation: z.string().max(10000).nullable(),
  source_url: z.url().max(2000).nullable(),
  cves: z.string().max(5000).nullable(),
})

function parseUpdate(fd: FormData) {
  const g = (k: string) => emptyToNull(fd.get(k))
  return updateSchema.parse({
    title: g('title') ?? '',
    product_id: g('product_id'),
    kb_number: g('kb_number'),
    release_date: g('release_date'),
    build_number: g('build_number'),
    version: g('version'),
    classification: g('classification') ?? 'other',
    severity: g('severity') ?? 'informational',
    reboot_required: g('reboot_required') ?? 'unknown',
    deployment_status: g('deployment_status') ?? 'not_reviewed',
    verification_status: g('verification_status') ?? 'unverified',
    description: g('description'),
    known_issues: g('known_issues'),
    prerequisites: g('prerequisites'),
    user_impact: g('user_impact'),
    infrastructure_impact: g('infrastructure_impact'),
    deployment_recommendation: g('deployment_recommendation'),
    source_url: g('source_url'),
    cves: g('cves'),
  })
}

async function linkCves(orgId: string, updateId: string, raw: string | null) {
  if (!raw) return
  const ids = Array.from(new Set((raw.toUpperCase().match(/CVE-\d{4}-\d{4,7}/g) ?? []))).slice(0, 200)
  if (ids.length === 0) return
  const admin = createAdminClient()
  await admin
    .from('cve_records')
    .upsert(ids.map((cve_id) => ({ organization_id: orgId, cve_id })), { onConflict: 'organization_id,cve_id', ignoreDuplicates: true })
  const { data: rows } = await admin.from('cve_records').select('id').eq('organization_id', orgId).in('cve_id', ids)
  if (rows?.length) {
    await admin
      .from('update_cves')
      .upsert(rows.map((r) => ({ update_id: updateId, cve_record_id: r.id, organization_id: orgId })), { ignoreDuplicates: true })
  }
}

export async function createUpdate(_: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission('updates.write')
    const input = parseUpdate(fd)
    const supabase = await createClient()

    let productName: string | null = null
    let productCategory: string | null = null
    if (input.product_id) {
      const { data: p } = await supabase.from('products').select('name, category').eq('id', input.product_id).maybeSingle()
      if (!p) userError('Selected product was not found.')
      productName = p.name
      productCategory = p.category
    }

    const { cves, ...rest } = input
    const { data, error } = await supabase
      .from('update_records')
      .insert({
        ...rest,
        description: toPlainText(rest.description),
        known_issues: toPlainText(rest.known_issues),
        organization_id: session.organizationId,
        product_name: productName,
        product_category: productCategory,
        source_type: 'manual',
        catalog_url: rest.kb_number ? `https://www.catalog.update.microsoft.com/Search.aspx?q=${rest.kb_number}` : null,
        created_by: session.userId,
      })
      .select('id')
      .single()
    if (error) throw error

    await linkCves(session.organizationId, data.id, cves)
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'update.create',
      entityType: 'update',
      entityId: data.id,
      details: { title: rest.title, kb: rest.kb_number },
    })
    revalidatePath('/updates')
    return { ok: true, data: { id: data.id }, message: 'Update created.' }
  } catch (e) {
    return fail(e)
  }
}

const TRACKED = [
  'title', 'kb_number', 'release_date', 'build_number', 'version', 'classification', 'severity', 'reboot_required',
  'deployment_status', 'verification_status', 'description', 'known_issues', 'prerequisites', 'user_impact',
  'infrastructure_impact', 'deployment_recommendation', 'source_url', 'product_id',
] as const

export async function editUpdate(id: string, _: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission('updates.write')
    z.uuid().parse(id)
    const input = parseUpdate(fd)
    const supabase = await createClient()

    const { data: current } = await supabase.from('update_records').select('*').eq('id', id).maybeSingle()
    if (!current) userError('Update not found.')

    let productName = current.product_name as string | null
    let productCategory = current.product_category as string | null
    if (input.product_id !== current.product_id) {
      if (input.product_id) {
        const { data: p } = await supabase.from('products').select('name, category').eq('id', input.product_id).maybeSingle()
        if (!p) userError('Selected product was not found.')
        productName = p.name
        productCategory = p.category
      } else {
        productName = null
        productCategory = null
      }
    }

    const { cves, ...rest } = input
    const next = { ...rest, description: toPlainText(rest.description), known_issues: toPlainText(rest.known_issues) }
    const changes = TRACKED.filter((f) => String(current[f] ?? '') !== String((next as Record<string, unknown>)[f] ?? '')).map((f) => ({
      organization_id: session.organizationId,
      update_id: id,
      field: f,
      old_value: current[f] == null ? null : String(current[f]).slice(0, 4000),
      new_value: (next as Record<string, unknown>)[f] == null ? null : String((next as Record<string, unknown>)[f]).slice(0, 4000),
      changed_by: session.userId,
    }))

    const original = current.original_values ?? (current.source_type !== 'manual' ? Object.fromEntries(TRACKED.map((f) => [f, current[f]])) : null)

    const { error } = await supabase
      .from('update_records')
      .update({ ...next, product_name: productName, product_category: productCategory, original_values: original, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    if (changes.length) await createAdminClient().from('update_field_changes').insert(changes)
    await linkCves(session.organizationId, id, cves)
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'update.edit',
      entityType: 'update',
      entityId: id,
      details: { fields: changes.map((c) => c.field) },
    })
    revalidatePath(`/updates/${id}`)
    revalidatePath('/updates')
    return { ok: true, message: changes.length ? `Saved ${changes.length} change(s).` : 'No changes.' }
  } catch (e) {
    return fail(e)
  }
}

const assessmentSchema = z.object({
  overall_risk: z.enum(keys(RISK_LEVELS)).nullable(),
  recommendation: z.enum(keys(RECOMMENDATIONS)).nullable(),
  security_impact: z.string().max(10000).nullable(),
  infrastructure_impact: z.string().max(10000).nullable(),
  application_compatibility: z.string().max(10000).nullable(),
  user_impact: z.string().max(10000).nullable(),
  service_availability: z.string().max(10000).nullable(),
  reboot_requirements: z.string().max(5000).nullable(),
  backup_requirements: z.string().max(5000).nullable(),
  maintenance_window: z.string().max(5000).nullable(),
  prerequisites: z.string().max(5000).nullable(),
  testing_requirements: z.string().max(10000).nullable(),
  rollback_plan: z.string().max(10000).nullable(),
  deployment_strategy: z.string().max(10000).nullable(),
  technical_recommendation: z.string().max(10000).nullable(),
  notes_html: z.string().max(50000).nullable(),
})

export async function saveAssessment(updateId: string, _: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission('assessments.write')
    z.uuid().parse(updateId)
    const raw = Object.fromEntries(Object.keys(assessmentSchema.shape).map((k) => [k, emptyToNull(fd.get(k))]))
    const input = assessmentSchema.parse(raw)
    const supabase = await createClient()
    const { error } = await supabase.from('impact_assessments').upsert(
      {
        ...input,
        notes_html: sanitizeNotes(input.notes_html),
        organization_id: session.organizationId,
        update_id: updateId,
        assessed_by: session.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'update_id' },
    )
    if (error) throw error
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'assessment.save',
      entityType: 'update',
      entityId: updateId,
      details: { risk: input.overall_risk, recommendation: input.recommendation },
    })
    revalidatePath(`/updates/${updateId}`)
    return { ok: true, message: 'Impact assessment saved.' }
  } catch (e) {
    return fail(e)
  }
}

const deploymentSchema = z.object({
  environment: z.enum(keys(ENVIRONMENTS)),
  status: z.enum(keys(DEPLOYMENT_STATUSES)),
  deployment_date: z.iso.date().nullable(),
  assigned_engineer: z.string().max(200).nullable(),
  testing_result: z.enum(keys(TESTING_RESULTS)).nullable(),
  rollback_status: z.enum(keys(ROLLBACK_STATUSES)).nullable(),
  notes: z.string().max(10000).nullable(),
  final_outcome: z.string().max(5000).nullable(),
})

export async function saveDeployment(updateId: string, _: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission('deployments.write')
    z.uuid().parse(updateId)
    const raw = Object.fromEntries(Object.keys(deploymentSchema.shape).map((k) => [k, emptyToNull(fd.get(k))]))
    const input = deploymentSchema.parse(raw)
    const supabase = await createClient()
    const { error } = await supabase.from('deployment_records').upsert(
      {
        ...input,
        notes: toPlainText(input.notes),
        organization_id: session.organizationId,
        update_id: updateId,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'update_id,environment' },
    )
    if (error) throw error
    if (input.environment === 'production') {
      await supabase.from('update_records').update({ deployment_status: input.status }).eq('id', updateId)
    }
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'deployment.save',
      entityType: 'update',
      entityId: updateId,
      details: { environment: input.environment, status: input.status },
    })
    revalidatePath(`/updates/${updateId}`)
    revalidatePath('/deployments')
    return { ok: true, message: `${ENVIRONMENTS[input.environment]} deployment saved.` }
  } catch (e) {
    return fail(e)
  }
}

export async function addUpdatesToReport(reportId: string, updateIds: string[]): Promise<ActionResult> {
  try {
    const session = await requirePermission('reports.write')
    const ids = z.array(z.uuid()).min(1).max(500).parse(updateIds)
    z.uuid().parse(reportId)
    const supabase = await createClient()
    const { data: report } = await supabase.from('weekly_reports').select('id, status').eq('id', reportId).maybeSingle()
    if (!report) userError('Report not found.')
    if (['approved', 'published', 'archived'].includes(report.status)) userError('This report is locked. Reopen it to make changes.')
    const { error } = await supabase
      .from('report_updates')
      .upsert(ids.map((update_id) => ({ report_id: reportId, update_id, organization_id: session.organizationId })), { ignoreDuplicates: true })
    if (error) throw error
    await writeAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'report.add_updates',
      entityType: 'report',
      entityId: reportId,
      details: { count: ids.length },
    })
    revalidatePath(`/reports/${reportId}`)
    return { ok: true, message: `Added ${ids.length} update(s) to the report.` }
  } catch (e) {
    return fail(e)
  }
}
