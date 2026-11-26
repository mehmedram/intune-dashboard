import { requireSession } from '@/lib/auth'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { AppHeader } from '@/components/shell/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const permissions = Array.from(session.permissions)

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar permissions={permissions} organizationName={session.organizationName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          fullName={session.fullName}
          email={session.email}
          roleName={session.roleName}
          organizationName={session.organizationName}
          permissions={permissions}
        />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}
