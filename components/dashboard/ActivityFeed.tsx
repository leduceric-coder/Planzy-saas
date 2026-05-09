import { formatRelative } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { ActivityLog } from '@/lib/types'

const actionLabel: Record<string, string> = {
  created: 'a créé',
  updated: 'a modifié',
  deleted: 'a supprimé',
  status_changed: 'a changé le statut de',
  assigned: 'a assigné',
  commented: 'a commenté',
  uploaded: 'a uploadé',
}

const entityLabel: Record<string, string> = {
  task: 'la tâche',
  project: 'le chantier',
  issue: 'la réserve',
  document: 'le document',
  photo: 'une photo',
  message: 'un message',
}

interface Props {
  logs: (ActivityLog & { profile?: { full_name: string } | null })[]
}

export function ActivityFeed({ logs }: Props) {
  if (!logs.length) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-sm text-muted-foreground text-center">
        Aucune activité récente
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col divide-y divide-border">
      {logs.map(log => {
        const name = log.profile?.full_name ?? 'Système'
        const initials = getInitials(name)
        const meta = log.metadata as Record<string, string> | null

        return (
          <div key={log.id} className="flex items-start gap-3 p-3.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-[11px] font-700 flex items-center justify-center shrink-0 mt-0.5">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">
                <span className="font-600">{name}</span>{' '}
                <span className="text-muted-foreground">{actionLabel[log.action] ?? log.action}</span>{' '}
                <span className="text-muted-foreground">{entityLabel[log.entity_type] ?? log.entity_type}</span>
                {meta?.name && <span className="font-500"> «{meta.name}»</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(log.created_at)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
