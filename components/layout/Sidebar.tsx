'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Calendar, Building2, Users, MessageSquare,
  FolderOpen, FileText, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'
import type { Profile } from '@/lib/types'
import type { Theme } from '@/components/layout/ThemeProvider'
import { useAlerts } from './AlertsContext'
import { Tooltip } from '@/components/ui/Tooltip'
import { SidebarNewMenu } from './SidebarNewMenu'
import { SidebarUserMenu } from './SidebarUserMenu'
import type { TeamOption, ArtisanOption } from '@/components/ui/AssignmentPicker'
import {
  NAV_SECTIONS, navItemsBySection, isNavItemActive, navBadgeFor,
  type NavId, type NavItemConfig, type NavBadge, type BadgeTone, type AlertCounts, type NavAction,
} from '@/lib/navigation'

interface SidebarProps {
  profile: Profile | null
  onLogout: () => void
  onThemeChange: (t: Theme) => void
  theme: Theme
  projects?: { id: string; name: string; color: string }[]
  artisans?: ArtisanOption[]
  teams?: TeamOption[]
  onOpenMessages?: () => void
}

const COLLAPSE_KEY = 'planzy-sidebar-collapsed'

// Table de résolution icône (les icônes ne vivent pas dans le module de config
// pur `lib/navigation.ts`, qui doit rester testable hors React).
const NAV_ICONS: Record<NavId, React.ElementType> = {
  overview: LayoutDashboard,
  chantiers: Building2,
  planning: Calendar,
  rapports: FileText,
  equipe: Users,
  documents: FolderOpen,
  messages: MessageSquare,
}

// Tons de badge — jamais le rouge pour un simple total (cf. lib/navigation.ts).
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-primary/15 text-primary',
  attention: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  critical: 'bg-destructive text-white',
}

function NavBadgeView({ badge, collapsed }: { badge: NavBadge; collapsed: boolean }) {
  if (collapsed) {
    return (
      <span
        aria-hidden
        className={cn(
          'absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-700',
          'flex items-center justify-center ring-2 ring-surface',
          BADGE_TONE[badge.tone],
        )}
      >
        {badge.count > 9 ? '9+' : badge.count}
      </span>
    )
  }
  return (
    <span
      title={badge.label}
      aria-label={badge.label}
      className={cn(
        'ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-700 flex items-center justify-center',
        BADGE_TONE[badge.tone],
      )}
    >
      {badge.count > 99 ? '99+' : badge.count}
    </span>
  )
}

function NavItem({
  item, active, collapsed, badge, onAction,
}: {
  item: NavItemConfig
  active: boolean
  collapsed: boolean
  badge: NavBadge | null
  onAction?: (action: NavAction) => void
}) {
  const Icon = NAV_ICONS[item.id]
  const demoTarget = item.id === 'messages' ? 'sidebar-messages-button' : undefined
  const className = cn(
    'group relative flex items-center rounded-lg text-sm font-500 transition-colors motion-reduce:transition-none mx-2 w-[calc(100%-1rem)] text-left',
    collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-2.5 px-3 min-h-[40px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
    active
      ? 'bg-primary/10 text-foreground font-600'
      : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
  )

  const inner = (
    <>
      {/* Accent vertical discret sur le bord gauche (état actif). */}
      {active && (
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-r-full bg-primary',
            collapsed ? 'left-0 h-5 w-[3px]' : '-left-2 h-5 w-[3px]',
          )}
        />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'opacity-70')} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {badge && <NavBadgeView badge={badge} collapsed={collapsed} />}
    </>
  )

  // Entrée « action » (ex. Messages) : ouvre un panneau au lieu de naviguer.
  const node = item.action ? (
    <button
      type="button"
      onClick={() => onAction?.(item.action!)}
      data-demo-target={demoTarget}
      aria-haspopup="dialog"
      aria-label={collapsed ? item.label : undefined}
      className={className}
    >
      {inner}
    </button>
  ) : (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      data-demo-target={demoTarget}
      className={className}
    >
      {inner}
    </Link>
  )

  if (collapsed) {
    const tip = badge ? `${item.label} — ${badge.label}` : item.label
    return <Tooltip content={tip}>{node}</Tooltip>
  }
  return node
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 mb-1 mt-1">
      <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">{children}</span>
    </div>
  )
}

export function Sidebar({ profile, onLogout, onThemeChange, theme, projects = [], artisans = [], teams = [], onOpenMessages }: SidebarProps) {
  const pathname = usePathname()
  const alerts = useAlerts()
  const [collapsed, setCollapsed] = useState(false)

  const handleNavAction = (action: NavAction) => {
    if (action === 'open-messages') onOpenMessages?.()
  }

  // Persistance légère de la préférence ouvert/réduit (localStorage). Lue au
  // montage → état initial déterministe côté serveur, aucun mismatch SSR.
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true)
    } catch {}
  }, [])

  const toggleCollapsed = () =>
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch {}
      return next
    })

  const alertCounts: AlertCounts = {
    issuesCritical: alerts.issuesCritical,
    tasksLate: alerts.tasksLate,
    tasksBlocked: alerts.tasksBlocked,
    messagesRecent: alerts.messagesRecent,
  }

  return (
    <aside
      className={cn(
        'shrink-0 bg-surface border-r border-border flex flex-col h-full z-10 transition-[width] duration-200 motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* ── Marque + réduction ── */}
      {collapsed ? (
        <div className="pt-4 pb-2 px-2 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-center py-1">
            <KanvixMark size={34} />
          </div>
          <Tooltip content="Agrandir le menu">
            <button
              onClick={toggleCollapsed}
              aria-label="Agrandir le menu"
              aria-expanded={false}
              className="w-full flex items-center justify-center py-2 rounded-lg border border-border/60 text-muted-foreground hover:bg-elevated hover:text-foreground hover:border-border transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex h-14 items-center justify-between px-4 shrink-0">
          <KanvixLogo width={130} variant="auto" />
          <button
            onClick={toggleCollapsed}
            title="Réduire le menu"
            aria-label="Réduire le menu"
            aria-expanded
            className="p-1.5 rounded-md text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Bouton de création ── */}
      <div className={cn('mb-1', collapsed ? 'px-2' : 'px-3')}>
        <SidebarNewMenu
          collapsed={collapsed}
          orgId={profile?.org_id ?? null}
          userId={profile?.id ?? null}
          projects={projects}
          artisans={artisans}
          teams={teams}
        />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navigation principale">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.id}>
            {i > 0 && <div className={cn('my-3 h-px bg-border', collapsed ? 'mx-2' : 'mx-4')} />}
            {!collapsed && <SectionLabel>{section.label}</SectionLabel>}
            <div className="flex flex-col gap-0.5">
              {navItemsBySection(section.id).map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={isNavItemActive(pathname, item)}
                  collapsed={collapsed}
                  badge={item.badgeSource ? navBadgeFor(item.id, alertCounts) : null}
                  onAction={handleNavAction}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bloc utilisateur ── */}
      <div className={cn('border-t border-border', collapsed ? 'py-2 px-2' : 'pt-2 pb-3 px-3')}>
        <SidebarUserMenu
          profile={profile}
          collapsed={collapsed}
          theme={theme}
          onThemeChange={onThemeChange}
          onLogout={onLogout}
        />
      </div>
    </aside>
  )
}
