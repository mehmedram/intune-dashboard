import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONES = {
  default: 'bg-accent text-accent-foreground',
  danger: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  href,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: keyof typeof TONES
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', TONES[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </Link>
  )
}
