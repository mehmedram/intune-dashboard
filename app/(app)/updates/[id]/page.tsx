import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { requireSession, can } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Section, Field } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UpdateForm } from '@/components/updates/update-form'
import { AssessmentForm } from '@/components/updates/assessment-form'
import { DeploymentForm } from '@/components/updates/deployment-form'
import { AddToReport } from '@/components/updates/add-to-report'
import {
  CLASSIFICATIONS, SEVERITIES, REBOOT, DEPLOYMENT_STATUSES, SOURCE_TYPES, VERIFICATION, ENVIRONMENTS, CVE_SEVERITIES, EXPLOITATION,
  label, severityTone, statusTone,
} from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/dates'
import { editUpdate, saveAssessment, saveDeployment } from '../actions'

export default async function UpdateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: u }, products, assessment, deployments, history, cves, reports] = await Promise.all([
    supabase.from('update_records').select('*').eq('id', id).maybeSingle(),
    supabase.from('products').select('id, name, category').order('category').order('name'),
    supabase.from('impact_assessments').select('*').eq('update_id', id).maybeSingle(),
    supabase.from('deployment_records').select('*').eq('update_id', id),
    supabase.from('update_field_changes').select('id, field, old_value, new_value, changed_at').eq('update_id', id).order('changed_at', { ascending: false }).limit(50),
    supabase.from('update_cves').select('cve_records(id, cve_id, severity, cvss_score, cisa_kev, exploitation_status)').eq('update_id', id),
    supabase.from('weekly_reports').select('id, title, status').in('status', ['draft', 'under_review', 'rejected']).order('start_date', { ascending: false }).limit(20),
  ])
  if (!u) notFound()

  const cveList = (cves.data ?? []).map((r) => r.cve_records as unknown as { id: string; cve_id: string; severity: string | null; cvss_score: number | null; cisa_kev: boolean; exploitation_status: string }).filter(Boolean)
  const byEnv = new Map((deployments.data ?? []).map((d) => [d.environment, d]))
  const canEdit = can(session, 'updates.write')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={u.title}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={severityTone(u.severity)}>{label(SEVERITIES, u.severity)}</StatusBadge>
            <StatusBadge>{label(CLASSIFICATIONS, u.classification)}</StatusBadge>
            <StatusBadge tone={statusTone(u.deployment_status)}>{label(DEPLOYMENT_STATUSES, u.deployment_status)}</StatusBadge>
            <StatusBadge tone={statusTone(u.verification_status)}>{label(VERIFICATION, u.verification_status)}</StatusBadge>
          </span>
        }
        actions={can(session, 'reports.write') && <AddToReport updateIds={[u.id]} reports={reports.data ?? []} />}
      />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assessment">Impact assessment</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
          {canEdit && <TabsTrigger value="edit">Edit</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            <Section title="Details">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="KB number">{u.kb_number}</Field>
                <Field label="Product">{u.product_name ?? u.product_category}</Field>
                <Field label="Release date">{formatDate(u.release_date)}</Field>
                <Field label="Build">{u.build_number}</Field>
                <Field label="Version">{u.version}</Field>
                <Field label="Reboot required">{label(REBOOT, u.reboot_required)}</Field>
                <Field label="Source">{label(SOURCE_TYPES, u.source_type)}</Field>
                <Field label="Discovered">{formatDateTime(u.discovered_at)}</Field>
                <Field label="Last retrieved">{formatDateTime(u.last_retrieved_at)}</Field>
              </dl>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {u.source_url && (
                  <a href={u.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Official source <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                )}
                {u.catalog_url && (
                  <a href={u.catalog_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Microsoft Update Catalog <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </Section>
            {[
              ['Description', u.description],
              ['Known issues', u.known_issues],
              ['Prerequisites', u.prerequisites],
              ['User impact', u.user_impact],
              ['Infrastructure impact', u.infrastructure_impact],
              ['Deployment recommendation', u.deployment_recommendation],
            ]
              .filter(([, v]) => v)
              .map(([t, v]) => (
                <Section key={t} title={t as string}>
                  <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed">{v}</p>
                </Section>
              ))}
          </div>
          <Section title={`Associated CVEs (${cveList.length})`}>
            {cveList.length ? (
              <ul className="-my-1.5 flex flex-col">
                {cveList.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div>
                      <Link href={`/cves/${c.id}`} className="font-mono text-sm hover:underline">
                        {c.cve_id}
                      </Link>
                      <p className="text-xs text-muted-foreground">{label(EXPLOITATION, c.exploitation_status)}</p>
                    </div>
                    <div className="flex gap-1">
                      {c.cisa_kev && <StatusBadge tone="critical">KEV</StatusBadge>}
                      <StatusBadge tone={severityTone(c.severity)}>
                        {c.cvss_score ?? label(CVE_SEVERITIES, c.severity, 'Unscored')}
                      </StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No CVEs linked.</p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="assessment" className="mt-4">
          <AssessmentForm action={saveAssessment.bind(null, u.id)} values={assessment.data ?? {}} readOnly={!can(session, 'assessments.write')} />
        </TabsContent>

        <TabsContent value="deployment" className="mt-4 grid gap-4 lg:grid-cols-2">
          {(Object.keys(ENVIRONMENTS) as (keyof typeof ENVIRONMENTS)[]).map((env) => (
            <DeploymentForm
              key={env}
              environment={env}
              action={saveDeployment.bind(null, u.id)}
              values={byEnv.get(env) ?? {}}
              readOnly={!can(session, 'deployments.write')}
            />
          ))}
        </TabsContent>

        {canEdit && (
          <TabsContent value="edit" className="mt-4 max-w-4xl">
            {u.source_type !== 'manual' && (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This record was imported from {label(SOURCE_TYPES, u.source_type)}. Your edits are kept, and the original retrieved values are preserved in history.
              </p>
            )}
            <UpdateForm
              action={editUpdate.bind(null, u.id)}
              products={products.data ?? []}
              values={u}
              cves={cveList.map((c) => c.cve_id).join(', ')}
              submitLabel="Save changes"
            />
          </TabsContent>
        )}

        <TabsContent value="history" className="mt-4">
          <Section title="Field change history">
            {history.data?.length ? (
              <ul className="-my-2 divide-y">
                {history.data.map((h) => (
                  <li key={h.id} className="flex flex-col gap-0.5 py-2 text-sm">
                    <span>
                      <span className="font-medium">{h.field.replaceAll('_', ' ')}</span>{' '}
                      <span className="text-muted-foreground">changed {formatDateTime(h.changed_at)}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      <span className="line-through">{h.old_value || 'empty'}</span> → {h.new_value || 'empty'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No manual changes have been made.</p>
            )}
            {u.original_values && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium">Original retrieved values</summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(u.original_values, null, 2)}</pre>
              </details>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
