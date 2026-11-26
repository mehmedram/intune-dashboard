import { ZodError } from 'zod'
import { AuthorizationError } from '@/lib/auth'

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function fail(error: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: 'Please correct the highlighted fields.', fieldErrors }
  }
  if (error instanceof Error && error.message.startsWith('USER:')) {
    return { ok: false, error: error.message.slice(5) }
  }
  console.error('[action] unexpected error', error)
  return { ok: false, error: 'An unexpected error occurred. Please try again.' }
}

/** Throw an error whose message is safe to show to the user. */
export function userError(message: string): never {
  throw new Error(`USER:${message}`)
}

export function emptyToNull(value: FormDataEntryValue | null) {
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}
