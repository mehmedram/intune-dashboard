import { redirect } from 'next/navigation'
import { requireSession, can } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app/page-header'
import { UpdateForm } from '@/components/updates/update-form'
import { createUpdate } from '../actions'

export default async function NewUpdatePage() {
  const session = await requireSession()
  if (!can(session, 'updates.write')) redirect('/updates')
  const supabase = await createClient()
  const { data: products } = await supabase.from('products').select('id, name, category').eq('is_active', true).order('category').order('name')

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add update" description="Manually record a Microsoft update that is not covered by an automated source." />
      <UpdateForm action={createUpdate} products={products ?? []} submitLabel="Create update" redirect />
    </div>
  )
}
