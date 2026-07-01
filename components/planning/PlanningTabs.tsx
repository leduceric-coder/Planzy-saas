'use client'

import { useState } from 'react'
import { CalendarRange, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GanttView, type GanttTask } from './GanttView'
import { ResourceOccupancyView } from './ResourceOccupancyView'
import type { ProjectOption, ArtisanOption, TeamOption } from '@/components/tasks/TaskFormModal'

interface Props {
  tasks: GanttTask[]
  projects: ProjectOption[]
  artisans: ArtisanOption[]
  teams: TeamOption[]
}

export function PlanningTabs({ tasks, projects, artisans, teams }: Props) {
  const [view, setView] = useState<'tasks' | 'resources'>('tasks')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-1 bg-elevated border border-border rounded-lg p-1 mb-3 w-fit shrink-0">
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

      <div className="flex-1 overflow-hidden">
        {view === 'tasks' ? (
          <GanttView tasks={tasks} projects={projects} artisans={artisans} teams={teams} />
        ) : (
          <ResourceOccupancyView tasks={tasks} projects={projects} artisans={artisans} teams={teams} />
        )}
      </div>
    </div>
  )
}
