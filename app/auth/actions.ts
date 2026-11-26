'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

export type AuthState = { error?: string; message?: string } | undefined

const signInSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
})

export async function signIn(
  _: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { error: 'Enter a valid email address and password.' }
  }

  const ip = await clientIp()

  const limit = rateLimit(
    `signin:${ip}:${parsed.data.email.toLowerCase()}`,
    8,
    5 * 60_000
  )

  if (!limit.ok) {
    return {
      error: 'Too many sign-in attempts. Please wait a few minutes and try again.'
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    console.error('[auth] sign-in failed', error.code, error.status)

    if (error.code === 'email_not_confirmed') {
      return {
        error: 'Please confirm your email address using the link we sent before signing in.'
      }
    }

    if (error.status === 429) {
      return { error: 'Too many attempts. Please wait and try again.' }
    }

    if (error.code === 'invalid_credentials' || error.status === 400) {
      return { error: 'Invalid email or password.' }
    }

    return {
      error: 'Sign-in is temporarily unavailable. Please try again.'
    }
  }

  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('organization_id, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[auth] profile lookup failed', profileError.code)
    await supabase.auth.signOut()
    return {
      error: 'Sign-in is temporarily unavailable. Please try again.'
    }
  }

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return {
      error: 'Your account is disabled. Contact your administrator.'
    }
  }

  await admin
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id)

  await writeAudit({
    organizationId: profile.organization_id,
    userId: data.user.id,
    userEmail: data.user.email,
    action: 'user.login',
    entityType: 'user',
    entityId: data.user.id,
    details: { ip },
  })

  const next = parsed.data.next &&
    parsed.data.next.startsWith('/') &&
    !parsed.data.next.startsWith('//')
      ? parsed.data.next
      : '/'

  redirect(next)
}


const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(120),
  organizationName: z.string().trim().min(2, 'Enter your organization name').max(160),
  email: z.email().max(320),
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
  redirectTo: z.string().url().optional(),
})

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    organizationName: formData.get('organizationName'),
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' }

  const ip = await clientIp()
  const limit = rateLimit(`signup:${ip}`, 5, 60 * 60_000)
  if (!limit.ok) return { error: 'Too many sign-up attempts. Please try again later.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? parsed.data.redirectTo,
      data: { full_name: parsed.data.fullName, organization_name: parsed.data.organizationName },
    },
  })

  if (error) {
    console.error('[auth] sign-up failed', error.code, error.status)
    if (error.code === 'weak_password') return { error: 'Choose a stronger password.' }
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return { error: 'Too many requests. Please wait and try again.' }
    }
    if (error.code === 'email_address_invalid') return { error: 'That email address cannot be used.' }
    if (error.code === 'email_address_not_authorized') {
      return { error: 'Confirmation emails cannot be delivered to this address until custom SMTP is configured.' }
    }
    return { error: 'We could not create your account. Please try again.' }
  }

  redirect('/auth/sign-up-success')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
