import Link from 'next/link'
import { subDays } from 'date-fns'
import { AlertTriangle, FileClock, PackageSearch, ShieldAlert } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Section, EmptyState } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { StatCard } from '@/components/dashboard/stat-card'
import { CLASSIFICATIONS, SEVERITIES, REPORT_STATUSES, label, severityTone, statusTone } from '@/lib/constants'
import { formatDate, relative } from '@/lib/dates'

export default async function DashboardPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const since = subDays(new Date(), 7).toISOString()

  const [newUpdates, criticalUpdates, kevCves, pendingReports, recent, sources, reports] = await Promise.all([
    supabase.from('update_records').select('id', { count: 'exact', head: true }).gte('discovered_at', since),
    supabase
      .from('update_records')
      .select('id', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .not('deployment_status', 'in', '(deployed,rejected)'),
    supabase.from('cve_records').select('id', { count: 'exact', head: true }).eq('cisa_kev', true).neq('remediation_status', 'remediated'),
    supabase.from('weekly_reports').select('id', { count: 'exact', head: true }).in('status', ['under_review', 'pending_approval']),
    supabase
      .from('update_records')
      .select('id, title, kb_number, product_name, classification, severity, release_date, deployment_status')
      .order('discovered_at', { ascending: false })
      .limit(8),
    supabase.from('update_sources').select('id, name, status, last_success_at, enabled').order('name'),
    supabase
      .from('weekly_reports')
      .select('id, title, status, start_date, end_date')
      .order('start_date', { ascending: false })
      .limit(5),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${session.fullName.split(' ')[0]}`}
        description="Overview of Microsoft update intelligence, vulnerabilities and change activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New updates (7 days)" value={newUpdates.count ?? 0} icon={PackageSearch} href="/updates" />
        <StatCard label="Open critical updates" value={criticalUpdates.count ?? 0} icon={AlertTriangle} tone="danger" href="/updates?severity=critical" />
        <StatCard label="Unremediated KEV CVEs" value={kevCves.count ?? 0} icon={ShieldAlert} tone="danger" href="/cves?kev=1" />
        <StatCard label="Reports awaiting approval" value={pendingReports.count ?? 0} icon={FileClock} tone="warning" href="/reports" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section
            title="Recently discovered updates"
            actions={
              <Link href="/updates" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            }
          >
            {recent.data && recent.data.length > 0 ? (
              <ul className="-my-2 divide-y">
                {recent.data.map((u) => (
                  <li key={u.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/updates/${u.id}`} className="line-clamp-1 text-sm font-medium hover:underline">
                        {u.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[u.kb_number, u.product_name, label(CLASSIFICATIONS, u.classification), formatDate(u.release_date)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <StatusBadge tone={severityTone(u.severity)}>{label(SEVERITIES, u.severity)}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No updates yet"
                description="Run a sync from Data sources to import Microsoft security updates, or add an update manually."
                action={
                  <Link href="/sources" className="text-sm font-medium text-primary hover:underline">
                    Go to data sources
                  </Link>
                }
              />
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Data source health">
            <ul className="-my-1.5 flex flex-col">
              {(sources.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Last success {relative(s.last_success_at)}</p>
                  </div>
                  <StatusBadge tone={s.enabled ? statusTone(s.status) : 'neutral'}>
                    {s.enabled ? s.status.replaceAll('_', ' ') : 'disabled'}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Weekly reports"
            actions={
              <Link href="/reports" className="text-sm font-medium text-primary hover:underline">
                All reports
              </Link>
            }
          >
            {reports.data && reports.data.length > 0 ? (
              <ul className="-my-1.5 flex flex-col">
                {reports.data.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <Link href={`/reports/${r.id}`} className="block truncate text-sm hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.start_date)} – {formatDate(r.end_date)}
                      </p>
                    </div>
                    <StatusBadge tone={statusTone(r.status)}>{label(REPORT_STATUSES, r.status)}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
