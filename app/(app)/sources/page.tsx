import { requireSession, can } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { graphConfig } from '@/lib/connectors/http'
import { PageHeader, Section } from '@/components/app/page-header'
import { SourceCard } from '@/components/sources/source-card'
import { StatusBadge } from '@/components/app/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/dates'

export default async function SourcesPage() {
  const session = await requireSession()
  const supabase = await createClient()
  const [{ data: sources }, { data: logs }] = await Promise.all([
    supabase.from('update_sources').select('*').order('requires_auth').order('name'),
    supabase
      .from('source_sync_logs')
      .select('id, trigger, status, started_at, finished_at, records_found, records_created, records_updated, attempts, error, update_sources(name)')
      .order('started_at', { ascending: false })
      .limit(30),
  ])
  const graphReady = !!graphConfig()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Data sources"
        description="Official Microsoft and government sources. Scheduled sync runs every 30 minutes and processes sources that are due."
      />
      {!graphReady && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Microsoft Graph sources need an Entra ID app registration with <code className="font-mono">ServiceMessage.Read.All</code>,{' '}
          <code className="font-mono">ServiceHealth.Read.All</code> and <code className="font-mono">WindowsUpdates.ReadWrite.All</code> application permissions. Add{' '}
          <code className="font-mono">MS_TENANT_ID</code>, <code className="font-mono">MS_CLIENT_ID</code> and <code className="font-mono">MS_CLIENT_SECRET</code> in Vars.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {(sources ?? []).map((s) => (
          <SourceCard
            key={s.id}
            source={s}
            canRun={can(session, 'sync.run')}
            canConfigure={can(session, 'integrations.manage')}
            configured={!s.requires_auth || graphReady}
          />
        ))}
      </div>
      <Section title="Recent synchronization runs">
        {logs?.length ? (
          <div className="-mx-4 -mb-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Found / New / Refreshed</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{(l.update_sources as unknown as { name: string } | null)?.name}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatDateTime(l.started_at)}</TableCell>
                    <TableCell className="text-sm capitalize">{l.trigger}</TableCell>
                    <TableCell>
                      <StatusBadge tone={l.status === 'success' ? 'success' : l.status === 'error' ? 'danger' : 'info'}>{l.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {l.records_found} / {l.records_created} / {l.records_updated}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={l.error ?? undefined}>
                      {l.error ?? (l.attempts > 1 ? `${l.attempts} attempts` : '')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No synchronization has run yet. Use “Run now” on a source to start.</p>
        )}
      </Section>
    </div>
  )
}
