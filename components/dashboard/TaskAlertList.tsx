import Link from 'next/link'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { cn, formatDate, taskStatusLabel, taskStatusColor, isLate } from '@/lib/utils'
import type { Task } from '@/lib/types'

interface Props {
  tasks: (Task & { project?: { name: string } })[]
}

export function TaskAlertList({ tasks }: Props) {
  if (!tasks.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Aucune tâche urgente. Tout est sous contrôle 👍
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="divide-y divide-border">
        {tasks.map(task => {
          const late = isLate(task.end_date, task.status)
          const blocked = task.status === 'blocked'

          return (
            <div
              key={task.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-elevated transition-colors cursor-pointer group"
            >
              {/* Alert icon */}
              <div className={cn('shrink-0', late || blocked ? 'text-destructive' : 'text-yellow-500')}>
                {late ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-500 text-foreground truncate">{task.title}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-600 shrink-0', taskStatusColor(task.status))}>
                    {taskStatusLabel(task.status)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {task.project && <span>{task.project.name}</span>}
                  {task.end_date && (
                    <span className={cn(late && 'text-destructive font-500')}>
                      {late ? 'Échéance dépassée : ' : 'Échéance : '}
                      {formatDate(task.end_date)}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
