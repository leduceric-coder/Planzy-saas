'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Calendar, Building2, Users, MessageSquare,
  FolderOpen, FileText, Settings, ChevronDown, Plus, LogOut,
  Zap, Moon, Sun, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/types'

interface SidebarProps {
  profile: Profile | null
  onLogout: () => void
  onThemeToggle: () => void
  isDark: boolean
  projects?: { id: string; name: string; color: string }[]
}

const navMain = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Planning', href: '/planning', icon: Calendar },
  { label: 'Messages', href: '/messages', icon: MessageSquare, badge: 3 },
]

const navManagement = [
  { label: 'Chantiers', href: '/chantiers', icon: Building2 },
  { label: 'Équipes', href: '/equipes', icon: Users },
  { label: 'Documents', href: '/documents', icon: FolderOpen },
  { label: 'Rapports', href: '/rapports', icon: FileText },
]

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  active,
}: {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm font-500 transition-all duration-150',
        active
          ? 'bg-primary/12 text-primary font-600'
          : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'opacity-70')} />
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-700 flex items-center justify-center px-1">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

export function Sidebar({ profile, onLogout, onThemeToggle, isDark, projects = [] }: SidebarProps) {
  const pathname = usePathname()
  const [newDropdownOpen, setNewDropdownOpen] = useState(false)
  const [chantiersExpanded, setChantiersExpanded] = useState(true)

  const initials = profile?.full_name
    ? profile.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0]?.toUpperCase() ?? '?')

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col h-full z-10">
      {/* Brand */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-700 text-base tracking-tight text-foreground">Planzy</span>
        </div>
        <button
          onClick={onThemeToggle}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
          aria-label="Changer le thème"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Nouveau button */}
      <div className="px-3 mb-1 relative">
        <button
          onClick={() => setNewDropdownOpen(!newDropdownOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="flex-1 text-left">Nouveau</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', newDropdownOpen && 'rotate-180')} />
        </button>

        {newDropdownOpen && (
          <div className="absolute top-full left-3 right-3 mt-1 bg-elevated border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            {[
              { icon: Building2, label: 'Chantier', href: '/chantiers/nouveau' },
              { icon: Calendar, label: 'Tâche', href: '#' },
              { icon: MessageSquare, label: 'Message', href: '/messages' },
              { icon: AlertTriangle, label: 'Problème', href: '#' },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setNewDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-border transition-colors"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Navigation principale */}
      <div className="flex-1 overflow-y-auto py-2">
        <nav className="flex flex-col gap-0.5">
          {navMain.map(item => (
            <NavItem
              key={item.href}
              {...item}
              active={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
            />
          ))}
        </nav>

        <div className="mx-4 my-3 h-px bg-border" />

        <div className="px-4 mb-1">
          <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">
            Gestion
          </span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {navManagement.map(item => (
            <NavItem
              key={item.href}
              {...item}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </nav>

        {/* Chantiers list */}
        {projects.length > 0 && (
          <>
            <div className="mx-4 my-3 h-px bg-border" />
            <button
              onClick={() => setChantiersExpanded(!chantiersExpanded)}
              className="flex items-center gap-2 px-4 py-1 w-full text-left"
            >
              <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground flex-1">
                Chantiers actifs
              </span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 text-muted-foreground transition-transform',
                  chantiersExpanded && 'rotate-180'
                )}
              />
            </button>

            {chantiersExpanded && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {projects.slice(0, 8).map(project => (
                  <Link
                    key={project.id}
                    href={`/chantiers/${project.id}`}
                    className={cn(
                      'flex items-center gap-2.5 px-5 py-1.5 mx-2 rounded-lg text-sm transition-all',
                      pathname === `/chantiers/${project.id}`
                        ? 'bg-primary/8 text-primary font-500'
                        : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                    )}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: project.color }}
                    />
                    <span className="truncate text-xs">{project.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — user */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-elevated transition-colors cursor-pointer">
          <Avatar className="h-8 w-8">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-600 text-foreground truncate">{profile?.full_name ?? profile?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.role ?? 'Utilisateur'}</p>
          </div>
          <div className="flex gap-1">
            <Link href="/settings">
              <button className="p-1.5 rounded-md text-muted-foreground hover:bg-border hover:text-foreground transition-colors">
                <Settings className="h-3.5 w-3.5" />
              </button>
            </Link>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
