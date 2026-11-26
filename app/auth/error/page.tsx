import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Authentication error</h2>
      <p className="text-sm text-muted-foreground">
        The link is invalid or has expired. Request a new confirmation email or sign in again.
      </p>
      <Link href="/auth/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}
