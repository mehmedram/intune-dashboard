import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, EmptyState } from '@/components/app/page-header'
import { FilterBar } from '@/components/app/filter-bar'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CVE_SEVERITIES, EXPLOITATION, REMEDIATION, label, severityTone, statusTone } from '@/lib/constants'
import { formatDate } from '@/lib/dates'

const PAGE_SIZE = 50

export default async function CvesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  await requireSession()
  const supabase = await createClient()
  const page = Math.max(1, Number(sp.page) || 1)

  let query = supabase
    .from('cve_records')
    .select('id, cve_id, title, cvss_score, severity, exploitation_status, cisa_kev, kev_due_date, remediation_status, published_at', { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('cve_id', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, ' ').trim().slice(0, 100)
    query = query.or(`cve_id.ilike.%${q}%,title.ilike.%${q}%`)
  }
  if (sp.severity && sp.severity in CVE_SEVERITIES) query = query.eq('severity', sp.severity)
  if (sp.exploitation && sp.exploitation in EXPLOITATION) query = query.eq('exploitation_status', sp.exploitation)
  if (sp.remediation && sp.remediation in REMEDIATION) query = query.eq('remediation_status', sp.remediation)
  if (sp.kev === '1') query = query.eq('cisa_kev', true)

  const { data, count } = await query
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const pageHref = (p: number) => `/cves?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`

  return (
    <div>
      <PageHeader title="Vulnerabilities" description={`${count ?? 0} CVEs correlated from MSRC, NVD and the CISA KEV catalogue.`} />
      <FilterBar
        searchPlaceholder="CVE ID or title"
        filters={[
          { name: 'severity', label: 'Severity', options: CVE_SEVERITIES },
          { name: 'exploitation', label: 'Exploitation', options: EXPLOITATION },
          { name: 'remediation', label: 'Remediation', options: REMEDIATION },
          { name: 'kev', label: 'CISA KEV', options: { '1': 'Known exploited only' } },
        ]}
      />
      {data && data.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CVE</TableHead>
                <TableHead>CVSS</TableHead>
                <TableHead>Exploitation</TableHead>
                <TableHead>KEV due</TableHead>
                <TableHead>Remediation</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-md">
                    <Link href={`/cves/${c.id}`} className="font-mono text-sm font-medium hover:underline">
                      {c.cve_id}
                    </Link>
                    {c.title && <p className="line-clamp-1 whitespace-normal text-xs text-muted-foreground">{c.title}</p>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={severityTone(c.severity)}>
                      {c.cvss_score != null ? `${c.cvss_score} ${label(CVE_SEVERITIES, c.severity, '')}` : 'Unscored'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.cisa_kev && <StatusBadge tone="critical">KEV</StatusBadge>}
                      <StatusBadge tone={c.exploitation_status === 'exploited' ? 'danger' : c.exploitation_status === 'not_known' ? 'neutral' : 'warning'}>
                        {label(EXPLOITATION, c.exploitation_status)}
                      </StatusBadge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatDate(c.kev_due_date)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(c.remediation_status)}>{label(REMEDIATION, c.remediation_status)}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatDate(c.published_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No vulnerabilities found" description="CVEs are imported by the MSRC sync and enriched with NVD and CISA KEV data." />
      )}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
