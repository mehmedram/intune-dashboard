'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type FilterDef = { name: string; label: string; options: Record<string, string> }

export function FilterBar({ filters, searchPlaceholder }: { filters: FilterDef[]; searchPlaceholder: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function apply(fd: FormData) {
    const next = new URLSearchParams()
    for (const [k, v] of fd.entries()) {
      const s = String(v).trim()
      if (s) next.set(k, s)
    }
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <form action={apply} className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor="filter-q" className="text-xs text-muted-foreground">
          Search
        </label>
        <Input id="filter-q" name="q" defaultValue={params.get('q') ?? ''} placeholder={searchPlaceholder} className="h-9" />
      </div>
      {filters.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label htmlFor={`filter-${f.name}`} className="text-xs text-muted-foreground">
            {f.label}
          </label>
          <select
            id={`filter-${f.name}`}
            name={f.name}
            defaultValue={params.get(f.name) ?? ''}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {Object.entries(f.options).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit" size="sm" className="h-9">
        Apply
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => router.push(pathname)}>
        Reset
      </Button>
    </form>
  )
}
