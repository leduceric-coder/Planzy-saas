import { formatRelative, getInitials } from '@/lib/utils'
import type { ActivityLog } from '@/lib/types'

// ─── Action-first labels ────────────────────────────────────────────────────

const SINGULAR: Record<string, Record<string, string>> = {
  project:  { created: 'Chantier créé', updated: 'Chantier modifié', deleted: 'Chantier supprimé', status_changed: 'Statut chantier modifié' },
  task:     { created: 'Tâche créée', updated: 'Tâche modifiée', status_changed: 'Statut de tâche modifié', assigned: 'Tâche assignée', deleted: 'Tâche supprimée' },
  issue:    { created: 'Réserve créée', updated: 'Réserve modifiée', status_changed: 'Réserve mise à jour', deleted: 'Réserve supprimée' },
  document: { created: 'Document ajouté', updated: 'Document modifié', uploaded: 'Document uploadé', deleted: 'Document supprimé' },
  photo:    { created: 'Photo ajoutée', uploaded: 'Photo ajoutée', deleted: 'Photo supprimée' },
  message:  { created: 'Message envoyé', commented: 'Commentaire ajouté' },
}

const PLURAL: Record<string, Record<string, string>> = {
  project:  { created: 'chantiers créés', updated: 'chantiers modifiés', deleted: 'chantiers supprimés' },
  task:     { created: 'tâches créées', updated: 'tâches modifiées', status_changed: 'statuts modifiés', assigned: 'tâches assignées', deleted: 'tâches supprimées' },
  issue:    { created: 'réserves créées', updated: 'réserves modifiées', status_changed: 'réserves mises à jour', deleted: 'réserves supprimées' },
  document: { created: 'documents ajoutés', uploaded: 'documents uploadés' },
  photo:    { created: 'photos ajoutées', uploaded: 'photos ajoutées' },
  message:  { created: 'messages envoyés' },
}

function buildLabel(count: number, action: string, entity: string): string {
  if (count === 1) return SINGULAR[entity]?.[action] ?? `${entity}`
  const plural = PLURAL[entity]?.[action]
  return plural ? `${count} ${plural}` : `${count} actions`
}

// ─── Dot color per action ────────────────────────────────────────────────────

const ACTION_DOT: Record<string, string> = {
  created:        'bg-green-500',
  uploaded:       'bg-green-500',
  updated:        'bg-primary',
  status_changed: 'bg-amber-500',
  assigned:       'bg-blue-500',
  commented:      'bg-purple-500',
  deleted:        'bg-red-500',
}

// ─── Grouping ────────────────────────────────────────────────────────────────

type EnrichedLog = ActivityLog & { profile?: { full_name: string } | null }

type GroupedEntry = {
  id: string
  count: number
  log: EnrichedLog
}

/**
 * Groups logs by user + action + entity_type so that "Eric created 3 chantiers"
 * collapses to one entry showing the count, instead of three identical-looking rows.
 */
function groupLogs(logs: EnrichedLog[], limit: number): GroupedEntry[] {
  const groups = new Map<string, GroupedEntry>()
  for (const log of logs) {
    const key = `${log.user_id}|${log.action}|${log.entity_type}`
    if (groups.has(key)) {
      groups.get(key)!.count++
    } else {
      groups.set(key, { id: log.id, count: 1, log })
    }
  }
  return Array.from(groups.values()).slice(0, limit)
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  logs: EnrichedLog[]
  /** Max distinct groups shown (default 5). */
  limit?: number
}

export function ActivityFeed({ logs, limit = 5 }: Props) {
  const entries = groupLogs(logs, limit)

  if (!entries.length) {
    return (
      <div className="bg-surface border border-border/30 dark:border-white/[0.07] rounded-2xl p-6 text-[13px] text-muted-foreground text-center shadow-sm">
        Aucune activité récente
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border/30 dark:border-white/[0.07] rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/30 dark:border-white/[0.05]">
        <h2 className="text-xs font-700 uppercase tracking-widest text-muted-foreground">
          Activité récente
        </h2>
      </div>

      {/* Feed */}
      <div className="px-2 py-2">
        {entries.map(entry => {
          const { log, count } = entry
          const name = log.profile?.full_name ?? 'Système'
          const initials = getInitials(name)
          const meta = log.metadata as Record<string, string> | null
          const label = buildLabel(count, log.action, log.entity_type)
          const dotCls = ACTION_DOT[log.action] ?? 'bg-muted-foreground'

          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-elevated/40 transition-colors"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-700 flex items-center justify-center shrink-0 mt-0.5">
                {initials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Action label — action-first format */}
                <p className="text-[12px] font-600 text-foreground leading-snug">
                  {label}
                  {count === 1 && meta?.name && (
                    <span className="font-400 text-muted-foreground"> · «{meta.name}»</span>
                  )}
                </p>

                {/* Sub: who + when */}
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
                  <span>par {name} · {formatRelative(log.created_at)}</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
