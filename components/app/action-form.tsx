'use client'

import { useActionState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/action-result'

type Action = (prev: unknown, fd: FormData) => Promise<ActionResult<{ id?: string } | undefined>>

const FieldErrors = createContext<Record<string, string>>({})
export const useFieldError = (name: string) => useContext(FieldErrors)[name]

export function ActionForm({
  action,
  children,
  redirectTo,
  className,
}: {
  action: Action
  children: React.ReactNode
  redirectTo?: (id: string) => string
  className?: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, null)

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      if (state.message) toast.success(state.message)
      const id = state.data?.id
      if (redirectTo && id) router.push(redirectTo(id))
      else router.refresh()
    } else {
      toast.error(state.error)
    }
  }, [state, redirectTo, router])

  return (
    <FieldErrors.Provider value={state && !state.ok ? (state.fieldErrors ?? {}) : {}}>
      <form action={formAction} className={className} aria-busy={pending}>
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </form>
    </FieldErrors.Provider>
  )
}

export function SubmitButton({ children, variant }: { children: React.ReactNode; variant?: 'default' | 'outline' | 'secondary' | 'destructive' }) {
  return (
    <Button type="submit" variant={variant}>
      <Loader2 className="hidden size-4 animate-spin group-aria-busy:block" aria-hidden="true" />
      {children}
    </Button>
  )
}
