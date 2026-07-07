'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard, Calendar, Building2, Users, UserCog, MessageSquare,
  FolderOpen, FileText, Settings, ChevronDown, Plus, LogOut,
  Moon, Sun, PanelLeftClose, PanelLeftOpen, Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'
import type { Profile } from '@/lib/types'
import type { Theme } from '@/components/layout/ThemeProvider'
import { useAlerts } from './AlertsContext'
import { Tooltip } from '@/components/ui/Tooltip'
import { NouvelleTacheRapide } from './NouvelleTacheRapide'
import type { TeamOption, ArtisanOption } from '@/components/ui/AssignmentPicker'

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

const navPilotage = [
  { label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { label: 'Chantiers', href: '/chantiers', icon: Building2, alertKey: 'chantiers' as const },
  { label: 'Planning', href: '/planning', icon: Calendar },
]

const navRessources = [
  { label: 'Équipes & terrain', href: '/equipes', icon: Users },
  { label: 'Documents & photos', href: '/documents', icon: FolderOpen },
  { label: 'Rapports & alertes', href: '/rapports', icon: FileText },
]

const navAdmin = [
  { label: 'Membres & accès', href: '/settings/team', icon: UserCog },
]

type NewItem =
  | { icon: React.ElementType; label: string; href: string; action?: never }
  | { icon: React.ElementType; label: string; action: string; href?: never }

const NEW_ITEMS: NewItem[] = [
  { icon: Building2, label: 'Chantier', href: '/chantiers/nouveau' },
  { icon: Calendar, label: 'Tâche', action: 'quick-task' },
  { icon: MessageSquare, label: 'Message', href: '/messages' },
]

/* Gabarit unifié pour toutes les actions icône du footer compact.
 * w-10 h-10 centré dans la sidebar w-16 = 12px de marge de chaque côté.
 * Alignement visuel identique aux NavItem compacts (icône centrée). */
function SidebarIconBtn({
  children,
  tooltip,
  onClick,
  href,
  danger,
  active,
}: {
  children: React.ReactNode
  tooltip: string
  onClick?: () => void
  href?: string
  danger?: boolean
  active?: boolean
}) {
  const base = cn(
    'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-150',
    danger
      ? 'text-muted-foreground hover:bg-destructive/12 hover:text-destructive'
      : active
        ? 'bg-primary/12 text-primary'
        : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
  )
  const inner = href ? (
    <Link href={href} aria-label={tooltip} className={base}>{children}</Link>
  ) : (
    <button onClick={onClick} aria-label={tooltip} className={base}>{children}</button>
  )
  return <Tooltip content={tooltip}>{inner}</Tooltip>
}

function NavItem({
  href, icon: Icon, label, badge, badgeTooltip, active, collapsed,
}: {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
  badgeTooltip?: string
  active: boolean
  collapsed: boolean
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 py-2 mx-2 rounded-lg text-sm font-500 transition-all duration-150 relative',
        collapsed ? 'justify-center px-0' : 'px-3',
        active
          ? 'bg-primary/12 text-primary font-600'
          : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'opacity-70')} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge ? (
        <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-700 flex items-center justify-center px-1">
          {badge}
        </span>
      ) : null}
      {collapsed && badge ? (
        <span className="absolute top-0.5 right-0.5 w-[14px] h-[14px] rounded-full bg-destructive text-white text-[9px] font-700 flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  )

  if (collapsed) {
    const tooltipContent = badge && badgeTooltip ? `${label} — ${badgeTooltip}` : label
    return <Tooltip content={tooltipContent}>{link}</Tooltip>
  }
  if (badge && badgeTooltip) {
    return <Tooltip content={badgeTooltip}>{link}</Tooltip>
  }
  return link
}

export function Sidebar({ profile, onLogout, onThemeChange, theme, projects = [], artisans = [], teams = [], onOpenMessages }: SidebarProps) {
  const pathname = usePathname()
  const alerts = useAlerts()
  const [newDropdownOpen, setNewDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showQuickTask, setShowQuickTask] = useState(false)
  const newBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!newDropdownOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNewDropdownOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [newDropdownOpen])

  const openMiniDropdown = () => {
    if (newBtnRef.current) {
      const r = newBtnRef.current.getBoundingClientRect()
      setDropdownPos({ top: r.top, left: r.right + 8 })
    }
    setNewDropdownOpen(o => !o)
  }

  const handleNewItem = (item: NewItem) => {
    setNewDropdownOpen(false)
    if (item.action === 'quick-task') {
      setShowQuickTask(true)
    }
  }

  const planningBadge = (alerts.tasksLate + alerts.tasksBlocked) || undefined
  const chantiersBadge = alerts.issuesCritical || undefined
  const chantiersBadgeTooltip = chantiersBadge
    ? `${chantiersBadge} réserve${chantiersBadge > 1 ? 's' : ''} critique${chantiersBadge > 1 ? 's' : ''}`
    : undefined

  const initials = profile?.full_name
    ? profile.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0]?.toUpperCase() ?? '?')

  const ThemeIcon = theme === 'light' ? Sun : theme === 'system' ? Monitor : Moon
  const nextTheme: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
  const themeLabel = theme === 'dark' ? 'Mode sombre' : theme === 'light' ? 'Mode clair' : 'Mode système'

  const renderDropdownItems = (onLinkClick: () => void) =>
    NEW_ITEMS.map(item =>
      item.action ? (
        <button
          key={item.label}
          onClick={() => handleNewItem(item)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-border/60 transition-colors"
        >
          <item.icon className="h-4 w-4 text-muted-foreground" />
          {item.label}
        </button>
      ) : (
        <Link
          key={item.label}
          href={item.href!}
          onClick={onLinkClick}
          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-border/60 transition-colors"
        >
          <item.icon className="h-4 w-4 text-muted-foreground" />
          {item.label}
        </Link>
      ),
    )

  return (
    <>
      <aside
        className={cn(
          'shrink-0 bg-surface border-r border-border flex flex-col h-full z-10 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {collapsed ? (
          /* ── Mini-menu brand ── */
          <div className="pt-4 pb-2 px-2 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-center py-1">
              <KanvixMark size={34} />
            </div>
            <Tooltip content="Agrandir le menu">
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Agrandir le menu"
                className="w-full flex items-center justify-center py-2 rounded-lg border border-border/60 text-muted-foreground hover:bg-elevated hover:text-foreground hover:border-border transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        ) : (
          /* ── Menu normal brand ── */
          <div className="flex h-14 items-center justify-between px-4 shrink-0">
            <KanvixLogo width={130} variant="auto" />
            <button
              onClick={() => setCollapsed(true)}
              title="Réduire le menu"
              aria-label="Réduire le menu"
              className="p-1.5 rounded-md text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Bouton Nouveau ── */}
        {collapsed ? (
          /* Mini : bouton + dropdown via portal */
          <div className="px-2 mb-1">
            <Tooltip content={newDropdownOpen ? '' : 'Nouveau'}>
              <button
                ref={newBtnRef}
                onClick={openMiniDropdown}
                aria-label="Nouveau"
                className={cn(
                  'w-full flex items-center justify-center py-1.5 rounded-lg border transition-colors',
                  newDropdownOpen
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-elevated border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/10',
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tooltip>

            {newDropdownOpen && dropdownPos && mounted && createPortal(
              <>
                <div className="fixed inset-0 z-[9990]" onClick={() => setNewDropdownOpen(false)} />
                <div
                  className="fixed w-48 bg-elevated border border-border rounded-xl shadow-xl z-[9991] overflow-hidden"
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-700 uppercase tracking-widest text-muted-foreground/50">
                    Nouveau
                  </p>
                  {renderDropdownItems(() => setNewDropdownOpen(false))}
                </div>
              </>,
              document.body,
            )}
          </div>
        ) : (
          /* Normal : bouton pleine largeur */
          <div className="px-3 mb-1 relative">
            <button
              onClick={() => setNewDropdownOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span className="flex-1 text-left">Nouveau</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', newDropdownOpen && 'rotate-180')} />
            </button>

            {newDropdownOpen && (
              <div className="absolute top-full left-3 right-3 mt-1 bg-elevated border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                {renderDropdownItems(() => setNewDropdownOpen(false))}
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex-1 overflow-y-auto py-2">
          {!collapsed && (
            <div className="px-4 mb-1">
              <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">
                Pilotage
              </span>
            </div>
          )}
          <nav className="flex flex-col gap-0.5">
            {navPilotage.map(item => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                badge={'alertKey' in item ? chantiersBadge : item.href === '/planning' ? planningBadge : undefined}
                badgeTooltip={'alertKey' in item ? chantiersBadgeTooltip : undefined}
                active={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <div className={cn('my-3 h-px bg-border', collapsed ? 'mx-2' : 'mx-4')} />

          {!collapsed && (
            <div className="px-4 mb-1">
              <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">
                Ressources
              </span>
            </div>
          )}
          <nav className="flex flex-col gap-0.5">
            {navRessources.map(item => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
          </nav>

          {(profile?.role === 'owner' || profile?.role === 'admin') && (
            <>
              <div className={cn('my-3 h-px bg-border', collapsed ? 'mx-2' : 'mx-4')} />
              {!collapsed && (
                <div className="px-4 mb-1">
                  <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">
                    Administration
                  </span>
                </div>
              )}
              <nav className="flex flex-col gap-0.5">
                {navAdmin.map(item => (
                  <NavItem
                    key={item.href}
                    {...item}
                    active={pathname.startsWith(item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </nav>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={cn('border-t border-border', collapsed ? 'py-2' : 'pt-2 pb-3 px-3')}>
          {collapsed ? (
            /*
             * Compact footer — gabarit SidebarIconBtn (w-10 h-10 mx-auto rounded-lg)
             * Alignement icônes identique aux NavItem compacts.
             * Groupe 1 : communication (Messages)
             * Séparateur
             * Groupe 2 : système (Thème / Paramètres / Déconnexion)
             * Séparateur + avatar identité
             */
            <div className="flex flex-col gap-0.5">

              {/* --- Groupe communication --- */}
              <div className="relative" data-demo-target="sidebar-messages-button">
                {/* LOT 35 — libellé honnête : messages REÇUS RÉCEMMENT (48 h,
                    hors messages envoyés par l'utilisateur). Aucun « non lu ». */}
                <SidebarIconBtn
                  onClick={onOpenMessages}
                  tooltip={alerts.messagesRecent
                    ? `${alerts.messagesRecent} message${alerts.messagesRecent > 1 ? 's' : ''} reçu${alerts.messagesRecent > 1 ? 's' : ''} récemment`
                    : 'Messages'}
                  active={pathname.startsWith('/messages')}
                >
                  <MessageSquare className="h-4 w-4" />
                </SidebarIconBtn>
                {alerts.messagesRecent ? (
                  <span
                    aria-label={`${alerts.messagesRecent} message${alerts.messagesRecent > 1 ? 's' : ''} reçu${alerts.messagesRecent > 1 ? 's' : ''} récemment`}
                    className="pointer-events-none absolute top-0.5 right-2 w-[15px] h-[15px] rounded-full bg-destructive text-white text-[9px] font-700 flex items-center justify-center"
                  >
                    {alerts.messagesRecent > 9 ? '9+' : alerts.messagesRecent}
                  </span>
                ) : null}
              </div>

              <div className="h-px bg-border/70 mx-3 my-1" />

              {/* --- Groupe système --- */}
              <SidebarIconBtn
                tooltip={themeLabel}
                onClick={() => onThemeChange(nextTheme)}
              >
                <ThemeIcon className="h-4 w-4" />
              </SidebarIconBtn>

              <SidebarIconBtn href="/settings" tooltip="Paramètres">
                <Settings className="h-4 w-4" />
              </SidebarIconBtn>

              <SidebarIconBtn tooltip="Se déconnecter" onClick={onLogout} danger>
                <LogOut className="h-4 w-4" />
              </SidebarIconBtn>

              <div className="h-px bg-border/70 mx-3 my-1" />

              {/* --- Avatar identité --- */}
              <Tooltip content={profile?.full_name ?? profile?.email ?? 'Mon compte'}>
                <div className="flex justify-center py-1">
                  <Avatar className="h-8 w-8 cursor-default ring-2 ring-border/40">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="text-[10px] font-700">{initials}</AvatarFallback>
                  </Avatar>
                </div>
              </Tooltip>
            </div>

          ) : (
            /*
             * Normal footer
             * Ligne 1 : Messages (flex-1) + thème (w-8 h-8)
             * Ligne 2 : carte utilisateur + paramètres + déconnexion
             */
            <>
              <div className="flex items-center gap-1 mb-1.5">
                <button
                  data-demo-target="sidebar-messages-button"
                  onClick={onOpenMessages}
                  className={cn(
                    'flex items-center gap-2 flex-1 py-1.5 px-3 rounded-lg text-sm transition-all duration-150',
                    pathname.startsWith('/messages')
                      ? 'text-primary bg-primary/8'
                      : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="font-500">Messages</span>
                  {alerts.messagesRecent ? (
                    <span
                      aria-label={`${alerts.messagesRecent} message${alerts.messagesRecent > 1 ? 's' : ''} reçu${alerts.messagesRecent > 1 ? 's' : ''} récemment`}
                      title={`${alerts.messagesRecent} message${alerts.messagesRecent > 1 ? 's' : ''} reçu${alerts.messagesRecent > 1 ? 's' : ''} récemment`}
                      className="min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-700 flex items-center justify-center px-1"
                    >
                      {alerts.messagesRecent}
                    </span>
                  ) : null}
                </button>
                <Tooltip content={themeLabel}>
                  <button
                    onClick={() => onThemeChange(nextTheme)}
                    aria-label="Changer le thème"
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-all duration-150 shrink-0"
                  >
                    <ThemeIcon className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>

              {/* Carte utilisateur */}
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-elevated transition-colors">
                <Avatar className="h-8 w-8 shrink-0">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="text-xs font-600">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{profile?.full_name ?? profile?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role ?? 'Utilisateur'}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Link
                    href="/settings"
                    aria-label="Paramètres"
                    title="Paramètres"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={onLogout}
                    title="Se déconnecter"
                    aria-label="Se déconnecter"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-destructive/12 hover:text-destructive transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Quick task panel — rendered outside aside to avoid z-index stacking context ── */}
      {showQuickTask && profile?.org_id && mounted && createPortal(
        <NouvelleTacheRapide
          projects={projects}
          artisans={artisans}
          teams={teams}
          orgId={profile.org_id}
          onClose={() => setShowQuickTask(false)}
        />,
        document.body,
      )}
    </>
  )
}
