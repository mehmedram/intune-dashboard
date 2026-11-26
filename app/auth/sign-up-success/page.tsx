import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <MailCheck className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-semibold">Check your email</h2>
      <p className="text-sm text-muted-foreground">
        We sent a confirmation link to your inbox. Confirm your address, then sign in to finish setting up your organization.
      </p>
      <Link href="/auth/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}
