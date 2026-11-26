import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | undefined

/**
 * Service-role client for trusted server code (connectors, audit log, email delivery).
 * It bypasses RLS, so every query MUST be scoped by organization_id explicitly.
 */
export function createAdminClient() {
  if (!adminClient) {
    adminClient = createSupabaseClient(
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return adminClient
}
