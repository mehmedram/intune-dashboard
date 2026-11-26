import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireSession, can } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, EmptyState } from '@/components/app/page-header'
import { FilterBar } from '@/components/app/filter-bar'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CLASSIFICATIONS, SEVERITIES, DEPLOYMENT_STATUSES, SOURCE_TYPES, label, severityTone, statusTone } from '@/lib/constants'
import { formatDate } from '@/lib/dates'

const PAGE_SIZE = 50

export default async function UpdatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const session = await requireSession()
  const supabase = await createClient()
  const page = Math.max(1, Number(sp.page) || 1)

  let query = supabase
    .from('update_records')
    .select('id, title, kb_number, product_name, product_category, classification, severity, release_date, deployment_status, source_type', {
      count: 'exact',
    })
    .order('release_date', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, ' ').trim().slice(0, 100)
    query = query.or(`title.ilike.%${q}%,kb_number.ilike.%${q}%,product_name.ilike.%${q}%,build_number.ilike.%${q}%`)
  }
  if (sp.severity && sp.severity in SEVERITIES) query = query.eq('severity', sp.severity)
  if (sp.classification && sp.classification in CLASSIFICATIONS) query = query.eq('classification', sp.classification)
  if (sp.status && sp.status in DEPLOYMENT_STATUSES) query = query.eq('deployment_status', sp.status)
  if (sp.source && sp.source in SOURCE_TYPES) query = query.eq('source_type', sp.source)

  const { data, count, error } = await query
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const pageHref = (p: number) => `/updates?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`

  return (
    <div>
      <PageHeader
        title="Updates"
        description={`${count ?? 0} update records discovered from Microsoft sources and manual entry.`}
        actions={
          can(session, 'updates.write') && (
            <Button asChild>
              <Link href="/updates/new">
                <Plus aria-hidden="true" /> Add update
              </Link>
            </Button>
          )
        }
      />
      <FilterBar
        searchPlaceholder="Title, KB, product or build"
        filters={[
          { name: 'severity', label: 'Severity', options: SEVERITIES },
          { name: 'classification', label: 'Classification', options: CLASSIFICATIONS },
          { name: 'status', label: 'Deployment', options: DEPLOYMENT_STATUSES },
          { name: 'source', label: 'Source', options: SOURCE_TYPES },
        ]}
      />
      {error && <p className="mb-4 text-sm text-destructive">Could not load updates.</p>}
      {data && data.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Update</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Released</TableHead>
                <TableHead>Deployment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="max-w-md">
                    <Link href={`/updates/${u.id}`} className="line-clamp-2 whitespace-normal font-medium hover:underline">
                      {u.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {u.kb_number ?? 'No KB'} · {label(SOURCE_TYPES, u.source_type)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{u.product_name ?? u.product_category ?? '—'}</TableCell>
                  <TableCell className="text-sm">{label(CLASSIFICATIONS, u.classification)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={severityTone(u.severity)}>{label(SEVERITIES, u.severity)}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatDate(u.release_date)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(u.deployment_status)}>{label(DEPLOYMENT_STATUSES, u.deployment_status)}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No updates match" description="Adjust the filters, run a source sync, or add an update manually." />
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
