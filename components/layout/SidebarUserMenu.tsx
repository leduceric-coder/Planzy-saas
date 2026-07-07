'use client'

// Bloc utilisateur (bas de sidebar) + menu contextuel du profil.
// Contenu du menu :
//   • Mon profil                → /settings
//   • Administration / Membres  → /settings/team (owner / admin uniquement)
//   • Apparence                 → sous-menu Clair / Sombre / Système
//   • Déconnexion               → mécanisme d'authentification existant
// Les fonctions d'administration ne sont plus une section visible de la nav
// principale : elles vivent ici, conditionnées au rôle.

import { useRouter } from 'next/navigation'
import { UserCircle, ShieldCheck, Sun, Moon, Monitor, Palette, LogOut, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { canAccessAdmin } from '@/lib/navigation'
import type { Profile } from '@/lib/types'
import type { Theme } from '@/components/layout/ThemeProvider'

interface Props {
  profile: Profile | null
  collapsed: boolean
  theme: Theme
  onThemeChange: (t: Theme) => void
  onLogout: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Observateur',
}

export function SidebarUserMenu({ profile, collapsed, theme, onThemeChange, onLogout }: Props) {
  const router = useRouter()

  const initials = profile?.full_name
    ? profile.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0]?.toUpperCase() ?? '?')

  const displayName = profile?.full_name ?? profile?.email ?? 'Mon compte'
  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role] ?? profile.role) : 'Utilisateur'
  const isAdmin = canAccessAdmin(profile?.role)

  const menu = (
    <DropdownMenuContent side={collapsed ? 'right' : 'top'} align={collapsed ? 'end' : 'start'} className="w-60">
      <DropdownMenuLabel className="normal-case tracking-normal text-[11px]">
        <span className="block truncate text-sm font-600 text-foreground">{displayName}</span>
        <span className="block truncate text-xs font-400 text-muted-foreground">{roleLabel}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => router.push('/settings')}>
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        Mon profil
      </DropdownMenuItem>
      {isAdmin && (
        <DropdownMenuItem onSelect={() => router.push('/settings/team')}>
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Membres &amp; accès
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Palette className="h-4 w-4 text-muted-foreground" />
          Apparence
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-44">
          <DropdownMenuRadioGroup value={theme} onValueChange={v => onThemeChange(v as Theme)}>
            <DropdownMenuRadioItem value="light"><Sun className="h-4 w-4 text-muted-foreground" />Clair</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><Moon className="h-4 w-4 text-muted-foreground" />Sombre</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system"><Monitor className="h-4 w-4 text-muted-foreground" />Système</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onSelect={onLogout}>
        <LogOut className="h-4 w-4" />
        Déconnexion
      </DropdownMenuItem>
    </DropdownMenuContent>
  )

  if (collapsed) {
    return (
      <DropdownMenu>
        <Tooltip content={displayName}>
          <DropdownMenuTrigger
            aria-label={`Menu du profil — ${displayName}`}
            className="flex w-full justify-center py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Avatar className="h-8 w-8 ring-2 ring-border/40 transition-shadow hover:ring-primary/40 motion-reduce:transition-none">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-[10px] font-700">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
        </Tooltip>
        {menu}
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu du profil — ${displayName}`}
        className={cn(
          'group flex w-full items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors',
          'hover:bg-elevated data-[state=open]:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 motion-reduce:transition-none',
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="text-xs font-600">{initials}</AvatarFallback>
        </Avatar>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-600 text-foreground truncate">{displayName}</span>
          <span className="block text-xs text-muted-foreground truncate">{roleLabel}</span>
        </span>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground group-data-[state=open]:text-foreground" />
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  )
}
