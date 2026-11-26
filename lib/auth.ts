import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Permission =
  | 'updates.write'
  | 'cves.write'
  | 'reports.write'
  | 'reports.approve'
  | 'assessments.write'
  | 'deployments.write'
  | 'email.send'
  | 'templates.manage'
  | 'integrations.manage'
  | 'sync.run'
  | 'products.manage'
  | 'users.manage'
  | 'settings.manage'

export type SessionContext = {
  userId: string
  email: string
  fullName: string
  organizationId: string
  organizationName: string
  roleKey: string
  roleName: string
  department: string | null
  permissions: Set<Permission>
}

export class AuthorizationError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, email, full_name, department, role_key, is_active, roles(name), organizations(name)')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) return null

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_key', profile.role_key)

  const role = profile.roles as unknown as { name: string } | null
  const org = profile.organizations as unknown as { name: string } | null

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? '',
    fullName: profile.full_name ?? user.email ?? 'User',
    organizationId: profile.organization_id,
    organizationName: org?.name ?? 'Organization',
    roleKey: profile.role_key,
    roleName: role?.name ?? profile.role_key,
    department: profile.department,
    permissions: new Set((perms ?? []).map((p) => p.permission_key as Permission)),
  }
})

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  return session
}

export async function requirePermission(permission: Permission) {
  const session = await getSession()
  if (!session) throw new AuthorizationError('Your session has expired. Please sign in again.')
  if (!session.permissions.has(permission)) throw new AuthorizationError()
  return session
}

export function can(session: SessionContext, permission: Permission) {
  return session.permissions.has(permission)
}
