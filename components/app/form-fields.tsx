'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useFieldError } from './action-form'

function Wrapper({ id, label, hint, name, className, children }: { id: string; label: string; hint?: string; name: string; className?: string; children: React.ReactNode }) {
  const error = useFieldError(name)
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextField({
  name,
  label,
  defaultValue,
  type = 'text',
  required,
  placeholder,
  hint,
  className,
}: {
  name: string
  label: string
  defaultValue?: string | number | null
  type?: string
  required?: boolean
  placeholder?: string
  hint?: string
  className?: string
}) {
  const id = useId()
  const error = useFieldError(name)
  return (
    <Wrapper id={id} label={label} hint={hint} name={name} className={className}>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ''}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
      />
    </Wrapper>
  )
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  rows = 3,
  placeholder,
  hint,
  className,
}: {
  name: string
  label: string
  defaultValue?: string | null
  rows?: number
  placeholder?: string
  hint?: string
  className?: string
}) {
  const id = useId()
  const error = useFieldError(name)
  return (
    <Wrapper id={id} label={label} hint={hint} name={name} className={className}>
      <Textarea id={id} name={name} rows={rows} placeholder={placeholder} defaultValue={defaultValue ?? ''} aria-invalid={!!error} />
    </Wrapper>
  )
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  allowEmpty,
  hint,
  className,
}: {
  name: string
  label: string
  options: Record<string, string> | { value: string; label: string }[]
  defaultValue?: string | null
  allowEmpty?: string
  hint?: string
  className?: string
}) {
  const id = useId()
  const list = Array.isArray(options) ? options : Object.entries(options).map(([value, label]) => ({ value, label }))
  return (
    <Wrapper id={id} label={label} hint={hint} name={name} className={className}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  )
}
