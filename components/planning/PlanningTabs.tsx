'use client'

// ─── LOT 26B — Bascule Vue tâches / Vue ressources + CTA « Nouvelle tâche » ──────
// Enveloppe le GanttView riche du ZIP (signature complète préservée) et ajoute la
// vue occupation. La CTA réutilise NouvelleTacheRapide (déjà dotée d'un sélecteur
// de chantier), sans toucher au fonctionnement interne du Gantt (décision B).

import { useState } from 'react'
import { CalendarRange, Users, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GanttView } from './GanttView'
import {
  ResourceOccupancyView,
  type PlanningTask,
  type OccProjectOption,
  type OccArtisanOption,
  type OccTeamOption,
} from './ResourceOccupancyView'
import { NouvelleTacheRapide } from '@/components/layout/NouvelleTacheRapide'

interface Props {
  tasks: PlanningTask[]
  projects: OccProjectOption[]
  artisans: OccArtisanOption[]
  teams: OccTeamOption[]
  undatedTasks: PlanningTask[]
  initialFocusTaskId?: string
  initialView?: 'tasks' | 'resources'
  initialArtisanId?: string
  orgId: string
}

export function PlanningTabs({ tasks, projects, artisans, teams, undatedTasks, initialFocusTaskId, initialView, initialArtisanId, orgId }: Props) {
  const [view, setView] = useState<'tasks' | 'resources'>(initialView ?? 'tasks')
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-1 bg-elevated border border-border rounded-lg p-1 w-fit">
          <button
            onClick={() => setView('tasks')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-600 transition-colors',
              view === 'tasks' ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Vue tâches
          </button>
          <button
            onClick={() => setView('resources')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-600 transition-colors',
              view === 'resources' ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Vue ressources
          </button>
        </div>

        <button
          onClick={() => setShowNew(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouvelle tâche
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'tasks' ? (
          <GanttView
            tasks={tasks}
            projects={projects}
            artisans={artisans}
            teams={teams}
            undatedTasks={undatedTasks}
            initialFocusTaskId={initialFocusTaskId}
            onNewTask={() => setShowNew(true)}
          />
        ) : (
          <ResourceOccupancyView tasks={tasks} projects={projects} artisans={artisans} teams={teams} initialArtisan={initialArtisanId} />
        )}
      </div>

      {showNew && (
        <NouvelleTacheRapide
          projects={projects}
          artisans={artisans}
          teams={teams}
          orgId={orgId}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}
