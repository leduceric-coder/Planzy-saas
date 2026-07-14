'use client'

// Bouton de création « Nouveau chantier » (sidebar).
// - Clic principal → création d'un chantier (route existante /chantiers/nouveau).
// - Chevron → menu des autres créations RÉELLEMENT opérationnelles :
//     • Nouveau chantier   → /chantiers/nouveau (route)
//     • Nouvelle tâche      → modale NouvelleTacheRapide
//     • Ajouter un artisan  → /equipes/nouveau-artisan (route)
//     • Nouveau rapport     → modale GenererRapportModal
// Accessibilité (clavier, Échap, clic extérieur, fermeture après sélection,
// focus) fournie par la primitive DropdownMenu (Radix).

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Calendar, UserPlus, FileBarChart, Plus, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { NouvelleTacheRapide } from './NouvelleTacheRapide'
import { GenererRapportModal } from '@/components/rapports/GenererRapportModal'
import { useRole } from '@/components/layout/RoleContext'
import { canWrite } from '@/lib/permissions'
import type { TeamOption, ArtisanOption } from '@/components/ui/AssignmentPicker'

interface Props {
  collapsed: boolean
  orgId: string | null
  userId: string | null
  projects: { id: string; name: string; color: string }[]
  artisans: ArtisanOption[]
  teams: TeamOption[]
}

const CHANTIER_HREF = '/chantiers/nouveau'
const ARTISAN_HREF = '/equipes/nouveau-artisan'

export function SidebarNewMenu({ collapsed, orgId, userId, projects, artisans, teams }: Props) {
  const router = useRouter()
  const role = useRole()
  const [showQuickTask, setShowQuickTask] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // LOT 42 — le lecteur (viewer) ne crée rien : le menu « Nouveau » est masqué.
  if (!canWrite(role)) return null

  // La tâche rapide et le rapport nécessitent l'organisation courante.
  const canTask = Boolean(orgId)
  const canReport = Boolean(orgId && userId)

  const menuItems = (
    <>
      <DropdownMenuLabel>Créer</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => router.push(CHANTIER_HREF)}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        Nouveau chantier
      </DropdownMenuItem>
      {canTask && (
        <DropdownMenuItem onSelect={() => setShowQuickTask(true)}>
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Nouvelle tâche
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => router.push(ARTISAN_HREF)}>
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        Ajouter un artisan
      </DropdownMenuItem>
      {canReport && (
        <DropdownMenuItem onSelect={() => setShowReport(true)}>
          <FileBarChart className="h-4 w-4 text-muted-foreground" />
          Nouveau rapport
        </DropdownMenuItem>
      )}
    </>
  )

  return (
    <>
      {collapsed ? (
        // Mode réduit : bouton carré « + » qui ouvre directement le menu.
        <DropdownMenu>
          <Tooltip content="Créer">
            <DropdownMenuTrigger
              aria-label="Créer"
              className={cn(
                'flex w-10 h-10 mx-auto items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors',
                'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'data-[state=open]:bg-primary/90 motion-reduce:transition-none',
              )}
            >
              <Plus className="h-4 w-4" />
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent side="right" align="start">{menuItems}</DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // Mode ouvert : split button — action principale + chevron pour le menu.
        <div className="flex items-stretch rounded-lg bg-primary text-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => router.push(CHANTIER_HREF)}
            className="flex flex-1 items-center gap-2 px-3 py-2 text-sm font-600 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 transition-colors motion-reduce:transition-none"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Nouveau chantier</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Autres créations"
              className="group flex items-center justify-center px-2 border-l border-white/20 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 transition-colors data-[state=open]:bg-primary/80 motion-reduce:transition-none"
            >
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">{menuItems}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Modales portées vers document.body : évite tout piège de contexte
          d'empilement (z-index) hérité de l'aside. */}
      {mounted && showQuickTask && orgId && createPortal(
        <NouvelleTacheRapide
          projects={projects}
          artisans={artisans}
          teams={teams}
          orgId={orgId}
          onClose={() => setShowQuickTask(false)}
        />,
        document.body,
      )}
      {mounted && showReport && orgId && userId && createPortal(
        <GenererRapportModal
          orgId={orgId}
          userId={userId}
          projects={projects}
          onClose={() => setShowReport(false)}
        />,
        document.body,
      )}
    </>
  )
}
