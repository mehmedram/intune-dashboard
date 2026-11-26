'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, Search, ShieldCheck } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NavLinks } from './app-sidebar'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function AppHeader({
  fullName,
  email,
  roleName,
  organizationName,
  permissions,
}: {
  fullName: string
  email: string
  roleName: string
  organizationName: string
  permissions: string[]
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (!q) return
    router.push(/^CVE-\d{4}-\d+$/i.test(q) ? `/cves?q=${encodeURIComponent(q)}` : `/updates?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto border-sidebar-border bg-sidebar p-4 sm:max-w-xs">
          <DialogTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="size-4" aria-hidden="true" /> {organizationName}
          </DialogTitle>
          <NavLinks permissions={permissions} onNavigate={() => setMenuOpen(false)} />
        </DialogContent>
      </Dialog>

      <form onSubmit={onSearch} role="search" className="relative max-w-md flex-1">
        <label htmlFor="global-search" className="sr-only">
          Search updates, KB numbers or CVE IDs
        </label>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="global-search" name="q" placeholder="Search KB, CVE, product or title…" className="h-9 bg-background pl-8" />
      </form>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials(fullName)}
              </span>
              <span className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-sm font-medium">{fullName}</span>
                <span className="text-xs text-muted-foreground">{roleName}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{fullName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/settings')}>Settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => signOut()}>
              <LogOut aria-hidden="true" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
