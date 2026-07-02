import Link from 'next/link'
import { Clock, AlertOctagon, CheckCircle2, ArrowRight } from 'lucide-react'
import { cn, formatDate, isLate } from '@/lib/utils'
import type { Task } from '@/lib/types'

type RichTask = Task & {
  project?: { name: string }
  assignee?: { full_name: string; color: string } | null
}

interface Props {
  tasks: RichTask[]
}

function TaskChip({ task }: { task: RichTask }) {
  const late = isLate(task.end_date, task.status)
  return (
    <div className={cn(
      'rounded-xl p-3 flex flex-col gap-2',
      'bg-surface border border-border/30 dark:border-white/[0.05]',
      'hover:shadow-sm transition-shadow duration-150',
      late && 'border-red-500/20 dark:border-red-500/20',
    )}>
      {/* Title + avatar */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-600 text-foreground leading-snug line-clamp-2">{task.title}</p>
          {task.project && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{task.project.name}</p>
          )}
        </div>
        {task.assignee && (
          <div
            className="w-5 h-5 rounded-full text-[10px] font-700 text-white flex items-center justify-center shrink-0"
            style={{ background: task.assignee.color }}
            title={task.assignee.full_name}
          >
            {task.assignee.full_name[0]}
          </div>
        )}
      </div>
      {/* Date */}
      {task.end_date && (
        <p className={cn(
          'text-[11px] font-500 flex items-center gap-1',
          late ? 'text-red-500' : 'text-muted-foreground/60',
        )}>
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {late ? 'Dépassée : ' : ''}{formatDate(task.end_date)}
        </p>
      )}
    </div>
  )
}

function Column({
  title,
  icon: Icon,
  iconClass,
  colBg,
  tasks,
  emptyText,
}: {
  title: string
  icon: React.ElementType
  iconClass: string
  colBg: string
  tasks: RichTask[]
  emptyText: string
}) {
  const LIMIT = 3
  const visible = tasks.slice(0, LIMIT)
  const extra   = tasks.length - LIMIT

  return (
    <div className={cn('rounded-xl p-3.5 flex flex-col gap-2.5', colBg)}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-0.5">
        <Icon className={cn('h-3 w-3 shrink-0', iconClass)} />
        <span className="text-[12px] font-700 text-foreground flex-1">{title}</span>
        <span className="text-[10px] font-600 text-muted-foreground bg-background/80 border border-border/40 px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Items */}
      {visible.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/60 py-2">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map(t => <TaskChip key={t.id} task={t} />)}
        </div>
      )}

      {/* Overflow link */}
      {extra > 0 && (
        <Link
          href="/planning"
          className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-1 mt-0.5 transition-colors"
        >
          + {extra} autre{extra > 1 ? 's' : ''} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

export function TaskAlertList({ tasks }: Props) {
  if (!tasks.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border/50 rounded-2xl bg-background/40">
        Aucune tâche urgente — tout est sous contrôle 👍
      </div>
    )
  }

  const blocked    = tasks.filter(t => t.status === 'blocked')
  const late       = tasks.filter(t => isLate(t.end_date, t.status) && t.status !== 'blocked')
  const inProgress = tasks.filter(t => !isLate(t.end_date, t.status) && t.status !== 'blocked' && t.status === 'in_progress')
  const todo       = tasks.filter(t => !isLate(t.end_date, t.status) && t.status !== 'blocked' && t.status === 'todo')

  return (
    <div className={cn(
      'bg-surface rounded-2xl overflow-hidden',
      'border border-border/30 dark:border-white/[0.06]',
      'shadow-sm',
    )}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-border/30 dark:border-white/[0.05]">
        <h2 className="text-xs font-700 uppercase tracking-widest text-muted-foreground">
          Tâches prioritaires
        </h2>
        <Link
          href="/planning"
          className="text-xs text-primary hover:text-primary/80 font-600 flex items-center gap-1 transition-colors"
        >
          Planning <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* 3 colonnes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
        <Column
          title="À faire"
          icon={CheckCircle2}
          iconClass="text-muted-foreground"
          colBg="bg-background/60 dark:bg-elevated/30"
          tasks={todo}
          emptyText="Aucune tâche à faire"
        />
        <Column
          title="En cours"
          icon={Clock}
          iconClass="text-primary"
          colBg="bg-primary/[0.03] dark:bg-primary/[0.06]"
          tasks={inProgress}
          emptyText="Aucune tâche en cours"
        />
        <Column
          title="Retard & bloquées"
          icon={AlertOctagon}
          iconClass="text-red-500"
          colBg="bg-red-500/[0.04] dark:bg-red-500/[0.07]"
          tasks={[...late, ...blocked]}
          emptyText="Rien à signaler ✓"
        />
      </div>
    </div>
  )
}
