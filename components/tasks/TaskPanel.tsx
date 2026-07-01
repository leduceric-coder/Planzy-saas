'use client'

import { useState } from 'react'
import { X, Pencil, User, Calendar, Clock, AlertTriangle, CheckCircle, Flag, Loader2 } from 'lucide-react'
import { cn, taskStatusColor, taskStatusLabel, formatDate, priorityLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { updateTask, type TaskWithRelations } from '@/lib/actions/tasks'
import type { Task, TaskStatus } from '@/lib/types'

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'review', 'done', 'validated']

interface Props {
  task: Task & { assignee?: any; team?: any }
  onClose: () => void
  onEdit: () => void
  onStatusChanged?: (updated: TaskWithRelations) => void
}

export function TaskPanel({ task, onClose, onEdit, onStatusChanged }: Props) {
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStatusChange = async (s: TaskStatus) => {
    if (s === status || saving) return
    const previous = status
    setStatus(s)
    setSaving(true)
    setError(null)
    const result = await updateTask(task.id, { status: s })
    setSaving(false)
    if (result.error || !result.data) {
      setStatus(previous)
      setError(result.error ?? 'La mise à jour du statut a échoué.')
      return
    }
    onStatusChanged?.(result.data)
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[460px] bg-surface border-l border-border shadow-lg flex flex-col z-50 animate-slide-in-right">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <span className="bg-elevated border border-border px-3 py-1.5 rounded-full text-xs font-600 text-muted-foreground">
            Tâche
          </span>
          <span className={cn('text-xs px-2.5 py-1 rounded-full font-600', taskStatusColor(status))}>
            {taskStatusLabel(status)}
          </span>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Modifier la tâche
          </Button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive hover:text-white hover:rotate-90 transition-all duration-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-8 mb-4 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {/* Title */}
        <h2 className="text-2xl font-700 text-foreground mb-6 leading-tight">{task.title}</h2>

        {/* Status pills */}
        <div className="mb-6">
          <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Statut</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-600 border transition-all',
                  status === s
                    ? taskStatusColor(s) + ' border-current'
                    : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground bg-transparent'
                )}
              >
                {taskStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-background border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-600 mb-2">
              <Calendar className="h-3.5 w-3.5" />
              DÉBUT
            </div>
            <p className="text-sm font-600 text-foreground">{formatDate(task.start_date)}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-600 mb-2">
              <Calendar className="h-3.5 w-3.5" />
              FIN
            </div>
            <p className={cn('text-sm font-600', task.end_date && new Date(task.end_date) < new Date() && status !== 'done' && status !== 'validated' ? 'text-destructive' : 'text-foreground')}>
              {formatDate(task.end_date)}
            </p>
          </div>
        </div>

        {/* Assignee */}
        {task.assignee && (
          <div className="mb-6">
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Assigné à</p>
            <div className="flex items-center gap-3 bg-background border border-border rounded-xl p-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-700 text-white shrink-0"
                style={{ background: task.assignee.color }}
              >
                {task.assignee.full_name?.[0] ?? '?'}
              </div>
              <div>
                <p className="text-sm font-600 text-foreground">{task.assignee.full_name}</p>
                <p className="text-xs text-muted-foreground">{task.assignee.trade}</p>
              </div>
            </div>
          </div>
        )}

        {/* Team */}
        {task.assigned_team && task.team && (
          <div className="mb-6">
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Équipe</p>
            <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-3">
              <div className="w-2 h-2 rounded-full" style={{ background: task.team.color }} />
              <p className="text-sm font-600 text-foreground">{task.team.name}</p>
            </div>
          </div>
        )}

        {/* Hours */}
        {(task.estimated_hours || task.actual_hours) && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {task.estimated_hours && (
              <div className="bg-background border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-600 mb-2">
                  <Clock className="h-3.5 w-3.5" />ESTIMÉ
                </div>
                <p className="text-sm font-600 text-foreground">{task.estimated_hours}h</p>
              </div>
            )}
            {task.actual_hours && (
              <div className="bg-background border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-600 mb-2">
                  <Clock className="h-3.5 w-3.5" />RÉEL
                </div>
                <p className="text-sm font-600 text-foreground">{task.actual_hours}h</p>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div className="mb-6">
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Priority */}
        <div className="mb-6">
          <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Priorité</p>
          <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600', {
            'bg-muted text-muted-foreground': task.priority === 'low',
            'bg-primary/15 text-primary': task.priority === 'medium',
            'bg-yellow-500/15 text-yellow-500': task.priority === 'high',
            'bg-destructive/15 text-destructive': task.priority === 'critical',
          })}>
            <Flag className="h-3 w-3" />
            {priorityLabel(task.priority)}
          </div>
        </div>
      </div>
    </div>
  )
}
