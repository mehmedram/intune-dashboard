'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/app/status-badge'
import { ActionForm, SubmitButton } from '@/components/app/action-form'
import { runSourceNow, saveSourceConfig } from '@/app/(app)/sources/actions'
import type { Tone } from '@/lib/constants'

type Source = {
  id: string
  name: string
  description: string | null
  source_url: string | null
  enabled: boolean
  requires_auth: boolean
  interval_minutes: number
  status: string
  last_attempt_at: string | null
  last_success_at: string | null
  last_error: string | null
  next_run_at: string
  records_total: number
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ok: { label: 'Healthy', tone: 'success' },
  error: { label: 'Error', tone: 'danger' },
  needs_configuration: { label: 'Needs configuration', tone: 'warning' },
  running: { label: 'Running', tone: 'info' },
  never_run: { label: 'Not yet run', tone: 'neutral' },
  disabled: { label: 'Disabled', tone: 'neutral' },
}

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never')

export function SourceCard({ source, canRun, canConfigure, configured }: { source: Source; canRun: boolean; canConfigure: boolean; configured: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const st = !configured && source.status !== 'disabled' ? STATUS.needs_configuration : (STATUS[source.status] ?? STATUS.never_run)

  function run() {
    start(async () => {
      const res = await runSourceNow(source.id)
      if (res.ok) toast.success(res.message)
      else toast.error(res.error)
      router.refresh()
    })
  }

  return (
    <article className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{source.name}</h2>
          <p className="text-pretty text-sm text-muted-foreground">{source.description}</p>
        </div>
        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
      </div>
      <dl className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Last success</dt>
          <dd>{fmt(source.last_success_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Last attempt</dt>
          <dd>{fmt(source.last_attempt_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Next run</dt>
          <dd>{source.enabled ? fmt(source.next_run_at) : 'Disabled'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Records created</dt>
          <dd className="tabular-nums">{source.records_total}</dd>
        </div>
      </dl>
      {source.last_error && <p className="mx-4 mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">{source.last_error}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t p-4">
        {canConfigure ? (
          <ActionForm action={saveSourceConfig.bind(null, source.id)} className="group flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={source.enabled} className="size-4 accent-primary" />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Every</span>
              <input
                type="number"
                name="interval_minutes"
                min={15}
                max={10080}
                defaultValue={source.interval_minutes}
                className="h-8 w-20 rounded-md border bg-background px-2 text-sm tabular-nums"
                aria-label="Interval in minutes"
              />
              <span className="text-muted-foreground">min</span>
            </label>
            <SubmitButton variant="outline">Save</SubmitButton>
          </ActionForm>
        ) : (
          <span className="text-xs text-muted-foreground">Every {source.interval_minutes} minutes</span>
        )}
        <div className="flex items-center gap-2">
          {source.source_url && (
            <Button asChild variant="ghost" size="sm">
              <a href={source.source_url} target="_blank" rel="noopener noreferrer">
                Source <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          )}
          {canRun && (
            <Button size="sm" onClick={run} disabled={pending || !source.enabled || !configured}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              Run now
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
