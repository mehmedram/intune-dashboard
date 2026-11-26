'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FilePlus2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { addUpdatesToReport } from '@/app/(app)/updates/actions'

export function AddToReport({ updateIds, reports }: { updateIds: string[]; reports: { id: string; title: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function add(reportId: string) {
    start(async () => {
      const res = await addUpdatesToReport(reportId, updateIds)
      if (res.ok) {
        toast.success(res.message)
        router.refresh()
      } else toast.error(res.error)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <FilePlus2 aria-hidden="true" /> Add to report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Editable reports</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {reports.length === 0 && <DropdownMenuItem onSelect={() => router.push('/reports/new')}>Create a weekly report…</DropdownMenuItem>}
        {reports.map((r) => (
          <DropdownMenuItem key={r.id} onSelect={() => add(r.id)}>
            <span className="truncate">{r.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
