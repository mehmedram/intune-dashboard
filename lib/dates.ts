import { format, getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek, formatDistanceToNowStrict } from 'date-fns'

export function isoWeekInfo(date: Date) {
  const start = startOfISOWeek(date)
  const end = endOfISOWeek(date)
  return {
    week: getISOWeek(date),
    year: getISOWeekYear(date),
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  }
}

/** Microsoft "Patch Tuesday": the second Tuesday of the given month. */
export function patchTuesday(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const offset = (2 - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, monthIndex, 1 + offset + 7))
}

export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy') {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, pattern)
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, 'dd MMM yyyy, HH:mm')
}

export function relative(value: string | Date | null | undefined) {
  if (!value) return 'never'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return 'never'
  return `${formatDistanceToNowStrict(d)} ago`
}
