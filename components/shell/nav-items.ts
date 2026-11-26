import {
  LayoutDashboard,
  PackageSearch,
  ShieldAlert,
  FileText,
  Rocket,
  Mail,
  Send,
  LayoutTemplate,
  Plug,
  Boxes,
  Users,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string }
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: 'Intelligence',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/updates', label: 'Updates', icon: PackageSearch },
      { href: '/cves', label: 'Vulnerabilities', icon: ShieldAlert },
    ],
  },
  {
    label: 'Change management',
    items: [
      { href: '/reports', label: 'Weekly reports', icon: FileText },
      { href: '/deployments', label: 'Deployments', icon: Rocket },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/email/compose', label: 'Compose email', icon: Mail, permission: 'email.send' },
      { href: '/email/history', label: 'Sent emails', icon: Send },
      { href: '/email/templates', label: 'Email templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/sources', label: 'Data sources', icon: Plug },
      { href: '/products', label: 'Products', icon: Boxes },
      { href: '/users', label: 'Users & roles', icon: Users, permission: 'users.manage' },
      { href: '/audit', label: 'Audit log', icon: ScrollText },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]
