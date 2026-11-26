'use client'

import { useActionState, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signUp } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, undefined)
  const [redirectTo, setRedirectTo] = useState('')

  useEffect(() => {
    setRedirectTo(`${window.location.origin}/auth/callback`)
  }, [])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="organizationName">Organization</Label>
        <Input id="organizationName" name="organizationName" autoComplete="organization" required className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="h-10" />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Create organization account
      </Button>
      <p className="text-xs text-muted-foreground">
        The first account creates a new organization and becomes its administrator. Administrators add further users from
        the Users page.
      </p>
    </form>
  )
}
