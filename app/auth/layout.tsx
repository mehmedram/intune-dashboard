import { ShieldCheck } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-[440px] shrink-0 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-white">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Update Intelligence</p>
            <p className="text-xs">& Change Manager</p>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <h1 className="text-pretty text-3xl font-semibold leading-tight text-white">
            Microsoft update intelligence for infrastructure and security teams.
          </h1>
          <ul className="flex flex-col gap-3 text-sm">
            <li>Automated discovery from MSRC, Microsoft Graph and Windows Release Health</li>
            <li>CVE enrichment from NVD and the CISA Known Exploited Vulnerabilities catalogue</li>
            <li>Structured impact assessment, deployment tracking and approvals</li>
            <li>Weekly change reports delivered through Microsoft 365 Outlook</li>
          </ul>
        </div>
        <p className="text-xs">All sign-ins and changes are recorded in the audit log.</p>
      </aside>
      <main className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
