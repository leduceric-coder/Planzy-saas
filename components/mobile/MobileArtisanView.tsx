'use client'

import { useState } from 'react'
import {
  CheckSquare, MessageSquare, Camera, AlertTriangle,
  Check, Clock, ChevronRight, X, Send, Plus
} from 'lucide-react'
import { cn, taskStatusColor, taskStatusLabel, formatDate, formatRelative } from '@/lib/utils'
import type { Task, Message, Issue, Profile } from '@/lib/types'

type Tab = 'today' | 'messages' | 'issues'

interface Artisan {
  id: string
  full_name: string
  trade: string
  color: string
}

interface Props {
  profile: Profile | null
  artisan: Artisan | null
  tasks: (Task & { project?: { name: string; color: string } | null })[]
  messages: (Message & { sender?: Profile | null; project?: { name: string; color: string } | null })[]
  issues: (Issue & { project?: { name: string } | null })[]
  currentUserId: string
}

const QUICK_MESSAGES = [
  { type: 'tache_terminee', label: '✅ Tâche terminée', color: 'bg-green-500/15 text-green-500 border-green-500/20' },
  { type: 'probleme', label: '🚨 Signaler un problème', color: 'bg-destructive/15 text-destructive border-destructive/20' },
  { type: 'livraison_absente', label: '📦 Livraison absente', color: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20' },
  { type: 'question', label: '❓ Poser une question', color: 'bg-primary/15 text-primary border-primary/20' },
  { type: 'validation_demandee', label: '🔍 Demander validation', color: 'bg-purple-500/15 text-purple-500 border-purple-500/20' },
]

export function MobileArtisanView({ profile, artisan, tasks, messages, issues, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('today')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [quickAction, setQuickAction] = useState<string | null>(null)

  const todayTasks = tasks.filter(t => {
    const end = t.end_date ? new Date(t.end_date) : null
    const today = new Date()
    return end && end <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
  })

  const lateTasks = tasks.filter(t => t.end_date && new Date(t.end_date) < new Date())

  const handleTaskDone = (taskId: string) => {
    // In production: update task status via Supabase
    console.log('Mark task done:', taskId)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="shrink-0 px-5 pt-12 pb-4 bg-surface border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-muted-foreground">Bonjour 👋</p>
            <h1 className="text-xl font-700 text-foreground">{artisan?.full_name ?? profile?.full_name}</h1>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-700"
            style={{ background: artisan?.color ?? '#2563EB' }}
          >
            {(artisan?.full_name ?? profile?.full_name ?? '?')[0]}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{artisan?.trade}</p>

        {/* Stats bar */}
        <div className="flex gap-4 mt-4">
          <div className="bg-background border border-border rounded-xl px-4 py-2.5 flex-1 text-center">
            <p className="text-xl font-700 text-foreground">{tasks.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tâches</p>
          </div>
          {lateTasks.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 flex-1 text-center">
              <p className="text-xl font-700 text-destructive">{lateTasks.length}</p>
              <p className="text-[10px] text-destructive uppercase tracking-wide">En retard</p>
            </div>
          )}
          <div className="bg-background border border-border rounded-xl px-4 py-2.5 flex-1 text-center">
            <p className="text-xl font-700 text-foreground">{issues.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Réserves</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-border bg-surface">
        {[
          { id: 'today' as Tab, label: 'Aujourd\'hui', icon: CheckSquare, count: tasks.length },
          { id: 'messages' as Tab, label: 'Messages', icon: MessageSquare, count: messages.length },
          { id: 'issues' as Tab, label: 'Problèmes', icon: AlertTriangle, count: issues.length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-600 transition-colors border-b-2',
              tab === t.id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
            )}
          >
            <div className="relative">
              <t.icon className="h-4.5 w-4.5" />
              {t.count > 0 && (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-700">
                  {t.count > 9 ? '9+' : t.count}
                </span>
              )}
            </div>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* TODAY — Tasks */}
        {tab === 'today' && (
          <div className="flex flex-col">
            {lateTasks.length > 0 && (
              <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2">
                <Clock className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive font-500">
                  {lateTasks.length} tâche{lateTasks.length > 1 ? 's' : ''} en retard
                </p>
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <CheckSquare className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-600 text-foreground mb-1">Aucune tâche assignée</p>
                <p className="text-sm text-center px-8">Vous n'avez pas de tâche en cours. Profitez-en !</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0 divide-y divide-border">
                {tasks.map(task => {
                  const isLate = task.end_date && new Date(task.end_date) < new Date()
                  return (
                    <div key={task.id} className="px-4 py-4 flex items-start gap-3">
                      {/* Status dot */}
                      <button
                        onClick={() => handleTaskDone(task.id)}
                        className={cn(
                          'mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                          task.status === 'done' || task.status === 'validated'
                            ? 'border-green-500 bg-green-500 text-white'
                            : task.status === 'in_progress'
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-transparent'
                        )}
                      >
                        {(task.status === 'done' || task.status === 'validated') && <Check className="h-3 w-3" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-600 leading-snug', task.status === 'done' || task.status === 'validated' ? 'line-through text-muted-foreground' : 'text-foreground')}>
                          {task.title}
                        </p>

                        {task.project && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: task.project.color }} />
                            {task.project.name}
                          </p>
                        )}

                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-600', taskStatusColor(task.status))}>
                            {taskStatusLabel(task.status)}
                          </span>
                          {task.end_date && (
                            <span className={cn('text-[10px] font-500', isLate ? 'text-destructive' : 'text-muted-foreground')}>
                              {isLate ? '⚠ ' : ''}{formatDate(task.end_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick actions */}
            <div className="p-4 border-t border-border mt-4">
              <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Actions rapides</p>
              <div className="flex flex-col gap-2">
                {QUICK_MESSAGES.map(qa => (
                  <button
                    key={qa.type}
                    onClick={() => { setQuickAction(qa.type); setTab('messages'); }}
                    className={cn('flex items-center gap-3 p-3.5 rounded-xl border font-500 text-sm text-left transition-all active:scale-[0.98]', qa.color)}
                  >
                    {qa.label}
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {tab === 'messages' && (
          <div className="flex flex-col h-full">
            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map(msg => {
                const isMine = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%]', isMine ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
                      {!isMine && (
                        <p className="text-xs text-muted-foreground px-1 font-600">{msg.sender?.full_name}</p>
                      )}
                      {msg.type !== 'text' ? (
                        <div className="rounded-2xl overflow-hidden border border-border bg-surface">
                          <div className="text-[10px] font-700 uppercase px-3 py-1.5 border-b border-border text-muted-foreground">
                            {msg.type.replace(/_/g, ' ')}
                          </div>
                          <p className="text-sm px-3 py-2 text-foreground">{msg.content}</p>
                        </div>
                      ) : (
                        <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed', isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-surface border border-border text-foreground rounded-bl-sm')}>
                          {msg.content}
                        </div>
                      )}
                      <p className={cn('text-[10px] px-1', isMine ? 'text-right text-muted-foreground' : 'text-muted-foreground')}>
                        {formatRelative(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center flex-1 py-20 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm">Aucun message</p>
                </div>
              )}
            </div>

            {/* Quick type selector */}
            {quickAction && (
              <div className="px-4 py-2 border-t border-border bg-elevated">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-600 text-primary">
                    Mode : {QUICK_MESSAGES.find(q => q.type === quickAction)?.label}
                  </span>
                  <button onClick={() => setQuickAction(null)} className="text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Send bar */}
            <div className="shrink-0 px-4 py-3 border-t border-border bg-surface pb-safe">
              {/* Quick type buttons */}
              <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                {QUICK_MESSAGES.map(qa => (
                  <button
                    key={qa.type}
                    onClick={() => setQuickAction(qa.type === quickAction ? null : qa.type)}
                    className={cn(
                      'shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-600 transition-all',
                      quickAction === qa.type ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'
                    )}
                  >
                    {qa.label.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 bg-elevated border border-border rounded-2xl px-3 py-2.5 flex items-end gap-2 focus-within:border-primary transition-colors">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder={quickAction ? QUICK_MESSAGES.find(q => q.type === quickAction)?.label + '...' : 'Message...'}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-20"
                    rows={1}
                  />
                  <button className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                    <Camera className="h-5 w-5" />
                  </button>
                </div>
                <button
                  onClick={() => { setSending(true); setTimeout(() => { setNewMessage(''); setQuickAction(null); setSending(false); }, 500); }}
                  disabled={!newMessage.trim() || sending}
                  className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ISSUES */}
        {tab === 'issues' && (
          <div className="flex flex-col">
            <div className="p-4 flex flex-col gap-3">
              {issues.map((issue: any) => (
                <div key={issue.id} className={cn('bg-surface border rounded-xl p-4 flex flex-col gap-2', issue.priority === 'critical' || issue.priority === 'high' ? 'border-destructive/30' : 'border-border')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', issue.priority === 'critical' || issue.priority === 'high' ? 'text-destructive' : 'text-yellow-500')} />
                      <div>
                        <p className="text-sm font-600 text-foreground">{issue.title}</p>
                        {issue.project && <p className="text-xs text-muted-foreground">{issue.project.name}</p>}
                      </div>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-600 shrink-0">
                      {issue.status}
                    </span>
                  </div>
                  {issue.description && (
                    <p className="text-xs text-muted-foreground pl-6">{issue.description}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Signaler un nouveau problème */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setTab('messages')}
                className="w-full py-3.5 border-2 border-dashed border-destructive/40 rounded-xl text-destructive font-600 text-sm flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Signaler un nouveau problème
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
