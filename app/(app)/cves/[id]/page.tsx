import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { requireSession, can } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Section, Field } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { CveAssessmentForm } from '@/components/cves/cve-assessment-form'
import { CVE_SEVERITIES, EXPLOITATION, SEVERITIES, label, severityTone } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/dates'
import { saveCveAssessment } from '../actions'

export default async function CveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const session = await requireSession()
  const supabase = await createClient()

  const [{ data: c }, impact, updates] = await Promise.all([
    supabase.from('cve_records').select('*').eq('id', id).maybeSingle(),
    supabase.from('cve_product_impact').select('id, product_name, kb_number, fixed_build, remediation_url').eq('cve_record_id', id).order('product_name'),
    supabase.from('update_cves').select('update_records(id, title, kb_number, severity, release_date)').eq('cve_record_id', id),
  ])
  if (!c) notFound()

  const linked = (updates.data ?? [])
    .map((r) => r.update_records as unknown as { id: string; title: string; kb_number: string | null; severity: string; release_date: string | null })
    .filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={c.cve_id}
        description={
          <span className="flex flex-col gap-2">
            {c.title && <span>{c.title}</span>}
            <span className="flex flex-wrap gap-1.5">
              <StatusBadge tone={severityTone(c.severity)}>
                {c.cvss_score != null ? `CVSS ${c.cvss_score} · ${label(CVE_SEVERITIES, c.severity)}` : 'CVSS not yet available'}
              </StatusBadge>
              {c.ms_severity && <StatusBadge tone={severityTone(c.ms_severity.toLowerCase())}>Microsoft: {c.ms_severity}</StatusBadge>}
              {c.cisa_kev && <StatusBadge tone="critical">CISA KEV</StatusBadge>}
              <StatusBadge tone={c.exploitation_status === 'exploited' ? 'danger' : 'neutral'}>{label(EXPLOITATION, c.exploitation_status)}</StatusBadge>
            </span>
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Section title="Vulnerability details">
            {c.description && <p className="mb-4 text-pretty text-sm leading-relaxed">{c.description}</p>}
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="CVSS version">{c.cvss_version}</Field>
              <Field label="Impact">{c.ms_impact}</Field>
              <Field label="Published">{formatDate(c.published_at)}</Field>
              <Field label="Last modified">{formatDate(c.last_modified_at)}</Field>
              <Field label="Fixed versions">{c.fixed_versions}</Field>
              <Field label="Affected versions">{c.affected_versions}</Field>
            </dl>
            {c.cvss_vector && <p className="mt-4 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{c.cvss_vector}</p>}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <a href={`https://msrc.microsoft.com/update-guide/vulnerability/${c.cve_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                MSRC advisory <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
              <a href={`https://nvd.nist.gov/vuln/detail/${c.cve_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                NVD entry <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </Section>

          {c.cisa_kev && (
            <Section title="CISA Known Exploited Vulnerability">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="Date added">{formatDate(c.kev_date_added)}</Field>
                <Field label="Due date">{formatDate(c.kev_due_date)}</Field>
                <Field label="Known ransomware use">{c.kev_ransomware_use}</Field>
              </dl>
              {c.kev_required_action && <p className="mt-4 text-sm">{c.kev_required_action}</p>}
            </Section>
          )}

          <Section title={`Affected products (${impact.data?.length ?? 0})`}>
            {impact.data?.length ? (
              <ul className="-my-1.5 divide-y">
                {impact.data.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span>{p.product_name}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.fixed_build && <span>Build {p.fixed_build}</span>}
                      {p.remediation_url ? (
                        <a href={p.remediation_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                          {p.kb_number ?? 'Remediation'}
                        </a>
                      ) : (
                        p.kb_number
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No affected product data from MSRC yet.</p>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <CveAssessmentForm action={saveCveAssessment.bind(null, c.id)} values={c} readOnly={!can(session, 'cves.write')} />
          <Section title="Related updates">
            {linked.length ? (
              <ul className="-my-1.5 flex flex-col">
                {linked.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 py-1.5">
                    <Link href={`/updates/${u.id}`} className="line-clamp-1 text-sm hover:underline">
                      {u.kb_number ? `${u.kb_number} – ` : ''}
                      {u.title}
                    </Link>
                    <StatusBadge tone={severityTone(u.severity)}>{label(SEVERITIES, u.severity)}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not linked to any update.</p>
            )}
          </Section>
          <Section title="Sync status">
            <dl className="flex flex-col gap-2">
              <Field label="MSRC">{formatDateTime(c.msrc_synced_at)}</Field>
              <Field label="NVD">{formatDateTime(c.nvd_synced_at)}</Field>
              <Field label="CISA KEV">{formatDateTime(c.kev_synced_at)}</Field>
            </dl>
          </Section>
        </div>
      </div>
    </div>
  )
}
