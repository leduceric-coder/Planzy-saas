'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Send, ExternalLink, MessageSquare, AlertTriangle, FileText, Camera } from 'lucide-react'
import { cn, formatRelative, getInitials, messageTypeLabel, messageTypeColor } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { mutationClient } from '@/lib/supabase/mutate'
import { isRecentIncoming } from '@/lib/messages-activity'
import type { Message, MessageType } from '@/lib/types'

interface Thread {
  id: string
  title: string | null
  type: string
  project?: { id: string; name: string; color: string } | null
  created_at: string
}

interface Project {
  id: string
  name: string
  color: string
  status?: string | null
}

// LOT 34 — une conversation = un chantier accessible (ou un thread direct).
interface Conversation {
  key: string
  projectId: string | null
  threadId: string | null
  name: string
  color: string
}

interface ContextStats {
  issues: number
  docs: number
  photos: number
}

const SEND_TYPES: { type: MessageType; label: string }[] = [
  { type: 'text', label: 'Message' },
  { type: 'consigne', label: 'Consigne' },
  { type: 'decision', label: 'Décision' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  currentUserId: string
  /** Préselectionne la conversation d'un chantier à l'ouverture (deep-link Dashboard). */
  initialProjectId?: string | null
}

export function MessagesSideWindow({ isOpen, onClose, orgId, currentUserId, initialProjectId }: Props) {
  const [mounted, setMounted] = useState(false)
  const [threads, setThreads] = useState<Thread[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<(Message & { sender?: { full_name: string | null } | null })[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('text')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [contextStats, setContextStats] = useState<ContextStats | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Load projects + threads + messages each time the window opens.
  // LOT 34 — La liste doit couvrir TOUS les chantiers accessibles (projects, non
  // archivés), pas seulement ceux ayant déjà un thread. RLS filtre déjà par org.
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    const supabase = createClient()
    Promise.all([
      supabase
        .from('projects')
        .select('id, name, color, status')
        .eq('org_id', orgId)
        .neq('status', 'archived')
        .order('name'),
      supabase
        .from('message_threads')
        .select('*, project:projects(id,name,color)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(id,full_name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]).then(([{ data: p }, { data: t }, { data: m }]) => {
      setProjects((p ?? []) as unknown as Project[])
      setThreads((t ?? []) as unknown as Thread[])
      setMessages((m ?? []) as unknown as (Message & { sender?: { full_name: string | null } | null })[])
      setLoading(false)
    })
  }, [isOpen, orgId])

  // Préselection éventuelle d'un chantier à l'ouverture (deep-link Dashboard).
  useEffect(() => {
    if (isOpen && initialProjectId) setSelectedKey(`project:${initialProjectId}`)
  }, [isOpen, initialProjectId])

  // Conversations = tous les chantiers accessibles (projects) ∪ threads directs.
  const conversations: Conversation[] = (() => {
    const byKey = new Map<string, Conversation>()
    for (const p of projects) {
      const thread = threads.find(t => t.project?.id === p.id) ?? null
      byKey.set(`project:${p.id}`, {
        key: `project:${p.id}`, projectId: p.id, threadId: thread?.id ?? null,
        name: p.name, color: p.color,
      })
    }
    for (const t of threads) {
      const pid = t.project?.id ?? null
      if (pid && byKey.has(`project:${pid}`)) continue
      byKey.set(`thread:${t.id}`, {
        key: `thread:${t.id}`, projectId: pid, threadId: t.id,
        name: t.title ?? t.project?.name ?? 'Conversation', color: t.project?.color ?? '#2563EB',
      })
    }
    return [...byKey.values()]
  })()

  const msgsOf = (c: Conversation) =>
    messages.filter(m =>
      (c.threadId && m.thread_id === c.threadId) || (c.projectId && m.project_id === c.projectId)
    )
  const lastMsgOf = (c: Conversation) => msgsOf(c)[0] ?? null

  // LOT 35 — activité ENTRANTE récente par conversation (hors messages émis par
  // l'utilisateur), même définition que le badge Sidebar (source : messages-activity).
  const incomingOf = (c: Conversation) => {
    const list = msgsOf(c).filter(m => isRecentIncoming(m, currentUserId))
    return { count: list.length, last: list[0] ?? null } // list déjà trié desc
  }

  // Tri : conversations avec entrant récent en tête (par date du dernier entrant),
  // puis autres avec activité, puis chantiers sans message, puis alphabétique.
  const sortedConversations = [...conversations].sort((a, b) => {
    const ia = incomingOf(a).last?.created_at ?? ''
    const ib = incomingOf(b).last?.created_at ?? ''
    if (ia || ib) { if (ia !== ib) return ia && ib ? ib.localeCompare(ia) : (ia ? -1 : 1) }
    const ta = lastMsgOf(a)?.created_at ?? ''
    const tb = lastMsgOf(b)?.created_at ?? ''
    if (ta && tb) return tb.localeCompare(ta)
    if (ta !== tb) return ta ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const selectedConversation =
    conversations.find(c => c.key === selectedKey) ?? sortedConversations[0] ?? null
  const projectId = selectedConversation?.projectId ?? null

  useEffect(() => {
    if (!projectId) { setContextStats(null); return }
    const supabase = createClient()
    Promise.all([
      supabase.from('issues').select('id', { count: 'exact', head: true }).eq('project_id', projectId).in('status', ['open', 'assigned', 'in_progress']),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('photos').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ]).then(([{ count: issues }, { count: docs }, { count: photos }]) => {
      setContextStats({ issues: issues ?? 0, docs: docs ?? 0, photos: photos ?? 0 })
    })
  }, [projectId])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Auto-scroll on conversation change or new message
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [selectedKey, messages.length])

  const threadMessages = selectedConversation
    ? messages.filter(m =>
        (selectedConversation.threadId && m.thread_id === selectedConversation.threadId) ||
        (selectedConversation.projectId && m.project_id === selectedConversation.projectId)
      )
    : []

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return
    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)
    // Réutilise le chemin de mutation existant : message indexé par project_id,
    // thread_id optionnel (un chantier sans thread reçoit son 1er message ainsi).
    const { data, error } = await mutationClient()
      .from('messages')
      .insert({
        org_id: orgId,
        project_id: selectedConversation.projectId,
        thread_id: selectedConversation.threadId,
        sender_id: currentUserId,
        content,
        type: messageType,
      })
      .select('*')
      .single()
    setSending(false)
    if (error) { setNewMessage(content); return }
    if (data) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [data, ...prev])
    }
    setMessageType('text')
  }

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop — light overlay to keep context visible */}
      <div
        className={cn(
          'fixed inset-0 z-[9980] bg-black/15 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Side window — 560px desktop, full-screen mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Messagerie terrain"
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[9981] w-full sm:w-[560px] bg-surface border-l border-border',
          'flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="font-700 text-sm text-foreground">Messagerie terrain</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={selectedConversation?.projectId ? `/messages?project=${selectedConversation.projectId}` : '/messages'}
              onClick={onClose}
              className="flex items-center gap-1 text-[11px] font-600 text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-elevated"
            >
              <ExternalLink className="h-3 w-3" />
              Vue complète
            </Link>
            <button
              onClick={onClose}
              aria-label="Fermer la messagerie"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: thread list + conversation */}
        <div className="flex-1 flex overflow-hidden">

          {/* Thread list — 200px, breathing room to avoid aggressive truncation */}
          <div className="w-[200px] shrink-0 border-r border-border flex flex-col bg-surface overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-xs text-muted-foreground">Chargement…</div>
            )}
            {!loading && sortedConversations.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">Aucun chantier</div>
            )}
            {sortedConversations.map(c => {
              const lastMsg = lastMsgOf(c)
              const incoming = incomingOf(c)
              const isActive = selectedConversation?.key === c.key
              const author = (incoming.last?.sender as { full_name?: string | null } | null)?.full_name ?? 'Équipe'
              return (
                <button
                  key={c.key}
                  onClick={() => setSelectedKey(c.key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-3 text-left border-b border-border/50 transition-colors',
                    isActive ? 'bg-primary/8 border-l-[3px] border-l-primary pl-[9px]' : 'hover:bg-elevated',
                  )}
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-700"
                      style={{ background: c.color }}
                    >
                      {getInitials(c.name)}
                    </div>
                    {/* Point d'activité entrante récente (jamais pour mes propres messages) */}
                    {incoming.count > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-surface" aria-hidden />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-600 text-foreground truncate leading-snug flex-1">{c.name}</p>
                      {incoming.count > 0 && (
                        <span
                          title={`${incoming.count} message${incoming.count > 1 ? 's' : ''} reçu${incoming.count > 1 ? 's' : ''} récemment`}
                          className="shrink-0 min-w-[16px] h-4 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[9px] font-700 flex items-center justify-center px-1 leading-none tabular-nums"
                        >
                          {incoming.count} récent{incoming.count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {incoming.count > 0 ? (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
                        <span className="font-600 text-foreground/80">{author}</span> : {incoming.last?.content}
                        {incoming.last?.created_at && (
                          <span className="text-muted-foreground/60"> · {formatRelative(incoming.last.created_at)}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
                        {lastMsg ? lastMsg.content : 'Aucun message'}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Conversation */}
          {selectedConversation ? (
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

              {/* Conv header */}
              <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-border bg-surface">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-700 shrink-0"
                  style={{ background: selectedConversation.color }}
                >
                  {getInitials(selectedConversation.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-700 text-foreground truncate">
                    {selectedConversation.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedConversation.projectId ? 'Messagerie chantier' : 'Conversation directe'}
                  </p>
                </div>
              </div>

              {/* Context stats bar — compact project context line */}
              {contextStats && (contextStats.issues > 0 || contextStats.docs > 0 || contextStats.photos > 0) && (
                <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 bg-elevated/50 border-b border-border/60">
                  {contextStats.issues > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-600 text-orange-500 dark:text-orange-400">
                      <AlertTriangle className="h-3 w-3" />
                      {contextStats.issues} réserve{contextStats.issues > 1 ? 's' : ''}
                    </span>
                  )}
                  {contextStats.docs > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-600 text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {contextStats.docs} doc{contextStats.docs > 1 ? 's' : ''}
                    </span>
                  )}
                  {contextStats.photos > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-600 text-muted-foreground">
                      <Camera className="h-3 w-3" />
                      {contextStats.photos} photo{contextStats.photos > 1 ? 's' : ''}
                    </span>
                  )}
                  {selectedConversation.projectId && (
                    <Link
                      href={`/chantiers/${selectedConversation.projectId}`}
                      onClick={onClose}
                      className="ml-auto text-[10px] text-primary hover:underline font-600"
                    >
                      Voir fiche →
                    </Link>
                  )}
                </div>
              )}

              {/* Messages feed */}
              <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
                {threadMessages.length === 0 && !loading && (
                  <div className="flex-1 flex items-center justify-center py-16">
                    <p className="text-xs text-muted-foreground text-center">Aucun message dans ce fil</p>
                  </div>
                )}
                {[...threadMessages].reverse().map((msg, i, arr) => {
                  const isMine = msg.sender_id === currentUserId
                  const typed = msg.type !== 'text'
                  const prevMsg = arr[i - 1]
                  const showSender = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id)
                  const isLastInGroup = !arr[i + 1] || arr[i + 1].sender_id !== msg.sender_id
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex flex-col', isMine ? 'items-end' : 'items-start', isLastInGroup ? 'mb-2' : 'mb-0')}
                    >
                      {showSender && (
                        <span className="text-[11px] font-600 text-muted-foreground mb-0.5 px-1">
                          {(msg.sender as any)?.full_name ?? 'Inconnu'}
                        </span>
                      )}
                      {typed ? (
                        <div className={cn(
                          'max-w-[88%] rounded-xl overflow-hidden border border-border bg-surface shadow-sm',
                          isMine && 'self-end',
                        )}>
                          <div className={cn(
                            'flex items-center gap-1.5 px-3 py-2 text-[10px] font-700 uppercase tracking-wide border-b border-border',
                            messageTypeColor(msg.type),
                          )}>
                            {messageTypeLabel(msg.type)}
                          </div>
                          <p className="px-3 py-2.5 text-xs text-foreground leading-relaxed">{msg.content}</p>
                          <p className="px-3 pb-2 text-[10px] text-muted-foreground text-right">
                            {formatRelative(msg.created_at)}
                          </p>
                        </div>
                      ) : (
                        <div className={cn(
                          'max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed',
                          isMine ? 'bubble-mine rounded-br-sm' : 'bubble-other rounded-bl-sm',
                        )}>
                          <p>{msg.content}</p>
                          <p className={cn('text-[10px] mt-1', isMine ? 'text-white/60 text-right' : 'text-muted-foreground')}>
                            {formatRelative(msg.created_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Send bar */}
              <div className="shrink-0 px-4 pt-2.5 pb-4 border-t border-border bg-surface">
                <div className="flex gap-1.5 mb-2.5 flex-wrap">
                  {SEND_TYPES.map(mt => (
                    <button
                      key={mt.type}
                      onClick={() => setMessageType(mt.type)}
                      className={cn(
                        'text-[11px] px-2.5 py-0.5 rounded-full font-600 border transition-all',
                        messageType === mt.type
                          ? mt.type === 'text'
                            ? 'bg-primary text-white border-primary'
                            : cn(messageTypeColor(mt.type), 'border-current')
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2 bg-elevated border border-border rounded-xl px-3 py-2.5 focus-within:border-primary transition-colors">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
                    placeholder={messageType === 'text' ? 'Votre message…' : `${messageTypeLabel(messageType)}…`}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
                    rows={1}
                    disabled={sending}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!newMessage.trim() || sending}
                    className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">Sélectionnez une conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
