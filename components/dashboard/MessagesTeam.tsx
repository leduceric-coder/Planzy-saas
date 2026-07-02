'use client'

import { useState } from 'react'
import { MessageCircle, ArrowRight, Paperclip, Send } from 'lucide-react'
import { formatRelative, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { DashboardMessagesPanel } from './DashboardMessagesPanel'

export type DashMessage = {
  id: string
  content: string
  type: string
  created_at: string
  project_id: string | null
  project?: { name: string } | null
  sender?: { full_name: string | null } | null
}

interface Props {
  messages: DashMessage[]
  orgId: string
  currentUserId: string
}

const TYPE_META: Record<string, { label: string; pill: string }> = {
  probleme:            { label: 'Problème',   pill: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  validation_demandee: { label: 'Validation', pill: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  consigne:            { label: 'Consigne',   pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  question:            { label: 'Question',   pill: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  tache_terminee:      { label: 'Terminé',    pill: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  photo:               { label: 'Info',       pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  text:                { label: 'Info',       pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981',
  '#3b82f6', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash)]
}

export function MessagesTeam({ messages, orgId, currentUserId }: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelProjectId, setPanelProjectId] = useState<string | null>(null)

  function openPanel(projectId?: string | null) {
    setPanelProjectId(projectId ?? null)
    setPanelOpen(true)
  }

  return (
    <>
      <section className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[340px]">
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/70" />
            <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
              Messagerie terrain
            </h2>
          </div>
          <button
            onClick={() => openPanel(null)}
            className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-0.5 transition-colors"
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Messages list */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
            <MessageCircle className="h-8 w-8 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground text-center">Aucun message récent.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border/[0.20] dark:divide-white/[0.05]">
            {messages.map(msg => {
              const senderName = msg.sender?.full_name ?? 'Équipe'
              const initials = getInitials(senderName)
              const color = avatarColor(senderName)
              const meta = TYPE_META[msg.type] ?? TYPE_META['text']

              return (
                <button
                  key={msg.id}
                  onClick={() => openPanel(msg.project_id)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-elevated/35 transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full text-white text-[11px] font-700 flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: color }}
                  >
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1 */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-700 text-foreground truncate">{senderName}</span>
                      {msg.project?.name && (
                        <span className="text-[10.5px] text-muted-foreground/65 truncate shrink-0">· {msg.project.name}</span>
                      )}
                      {meta && (
                        <span className={cn('text-[9px] font-700 px-1.5 py-0.5 rounded-full shrink-0 ml-auto', meta.pill)}>
                          {meta.label}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 shrink-0 whitespace-nowrap">
                        {formatRelative(msg.created_at)}
                      </span>
                    </div>
                    {/* Row 2 */}
                    <p className="text-[12px] text-muted-foreground/75 line-clamp-2 mt-0.5 leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Input bar — opens panel */}
        <div className="shrink-0 px-3 py-3 border-t border-border/20 dark:border-white/[0.05]">
          <button
            onClick={() => openPanel(null)}
            className="flex items-center gap-2 w-full"
          >
            <div className="flex-1 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-elevated/60 border border-border/25 hover:bg-elevated/80 transition-colors">
              <span className="text-[12px] text-muted-foreground/45 flex-1 text-left">Écrire un message…</span>
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center shrink-0">
              <Send className="h-3.5 w-3.5 text-white" />
            </div>
          </button>
        </div>
      </section>

      {panelOpen && (
        <DashboardMessagesPanel
          orgId={orgId}
          currentUserId={currentUserId}
          onClose={() => setPanelOpen(false)}
          initialProjectId={panelProjectId}
        />
      )}
    </>
  )
}
