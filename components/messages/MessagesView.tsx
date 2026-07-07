'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Plus, Search, MessageSquare } from 'lucide-react'
import { cn, formatRelative, getInitials, messageTypeLabel, messageTypeColor } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { mutationClient } from '@/lib/supabase/mutate'
import { NouvelleConversationModal } from './NouvelleConversationModal'
import { ContextPanel } from './ContextPanel'
import type { Message, Profile, MessageType, IssueStatus, TaskStatus } from '@/lib/types'

// The 5 types shown in the desktop send bar (spec LOT 3)
const SEND_TYPES: { type: MessageType; label: string }[] = [
  { type: 'text', label: 'Message' },
  { type: 'consigne', label: 'Consigne' },
  { type: 'probleme', label: 'Blocage' },
  { type: 'decision', label: 'Décision' },
  { type: 'validation_demandee', label: 'Validation' },
]

interface Thread {
  id: string
  title: string | null
  type: string
  project?: { id: string; name: string; color: string } | null
  created_at: string
}

// LOT 33 — une conversation = un chantier accessible (ou un thread direct).
interface Conversation {
  key: string
  projectId: string | null
  threadId: string | null
  name: string
  color: string
}

interface ContextTask { id: string; title: string; status: string; end_date: string | null; priority: string; project_id: string }
interface ContextDoc { id: string; name: string; file_type: string | null; created_at: string; project_id: string }
interface ContextPhoto { id: string; url: string; thumbnail_url: string | null; caption: string | null; created_at: string; project_id: string }
interface ContextIssue { id: string; title: string; status: string; priority: string; created_at: string; project_id: string }

interface Props {
  threads: Thread[]
  messages: (Message & { sender?: Profile | null })[]
  currentUserId: string
  profile: Profile | null
  orgId: string
  projects: { id: string; name: string; color: string }[]
  contextTasks?: ContextTask[]
  contextDocs?: ContextDoc[]
  contextPhotos?: ContextPhoto[]
  contextIssues?: ContextIssue[]
}

export function MessagesView({
  threads,
  messages,
  currentUserId,
  profile,
  orgId,
  projects,
  contextTasks = [],
  contextDocs = [],
  contextPhotos = [],
  contextIssues = [],
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<(Message & { sender?: Profile | null })[]>(messages)
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('text')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showNewThread, setShowNewThread] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  // LOT 33 — Liste sourcée depuis TOUS les chantiers accessibles (projects), pas
  // seulement ceux ayant déjà un thread : un chantier sans message doit apparaître.
  // Les threads sans chantier actif correspondant (directs / projets non actifs)
  // sont conservés. Les messages restent indexés par project_id (thread optionnel).
  const conversations = useMemo<Conversation[]>(() => {
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
  }, [projects, threads])

  const lastMsgOf = (c: Conversation) =>
    localMessages.find(m =>
      (c.threadId && m.thread_id === c.threadId) || (c.projectId && m.project_id === c.projectId)
    ) ?? null

  // Tri par activité récente (chantiers avec messages en tête), puis alphabétique.
  const sortedConversations = useMemo(() => {
    const rows = conversations.map(c => ({ c, last: lastMsgOf(c) }))
    rows.sort((a, b) => {
      const ta = a.last?.created_at ?? ''
      const tb = b.last?.created_at ?? ''
      if (ta && tb) return tb.localeCompare(ta)
      if (ta !== tb) return ta ? -1 : 1
      return a.c.name.localeCompare(b.c.name)
    })
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, localMessages])

  const filteredConversations = sortedConversations.filter(({ c }) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedConversation =
    conversations.find(c => c.key === selectedKey) ?? sortedConversations[0]?.c ?? null
  const selectedProjectId = selectedConversation?.projectId ?? null

  // Deep-link : /messages?project=<id> ouvre directement la conversation du chantier.
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('project')
    if (!pid) return
    const match = conversations.find(c => c.projectId === pid)
    if (match) setSelectedKey(match.key)
  }, [conversations])

  const threadMessages = selectedConversation
    ? localMessages.filter(m =>
        (selectedConversation.threadId && m.thread_id === selectedConversation.threadId) ||
        (selectedConversation.projectId && m.project_id === selectedConversation.projectId)
      )
    : []

  const panelProject = selectedConversation?.projectId
    ? { id: selectedConversation.projectId, name: selectedConversation.name, color: selectedConversation.color }
    : null
  const panelTasks = selectedProjectId ? contextTasks.filter(t => t.project_id === selectedProjectId) : []
  const panelDocs = selectedProjectId ? contextDocs.filter(d => d.project_id === selectedProjectId) : []
  const panelPhotos = selectedProjectId ? contextPhotos.filter(p => p.project_id === selectedProjectId) : []
  const panelIssues = selectedProjectId ? contextIssues.filter(i => i.project_id === selectedProjectId) : []

  // Realtime subscription — DO NOT MODIFY: JWT + dedup pattern must stay intact
  useEffect(() => {
    const supabase = createClient()
    const channelName = `desktop-messages-${orgId.slice(0, 8)}`
    let ch: ReturnType<typeof supabase.channel> | null = null
    let unmounted = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (unmounted) return
      if (!session) return
      supabase.realtime.setAuth(session.access_token)
      ch = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const row = payload.new as Message
            if (row.org_id !== orgId) return
            setLocalMessages(prev => {
              if (prev.some(m => m.id === row.id)) return prev
              const knownSender = prev.find(m => m.sender_id === row.sender_id)?.sender ?? undefined
              return [{ ...row, sender: knownSender }, ...prev]
            })
          }
        )
        .subscribe()
    })

    return () => {
      unmounted = true
      if (ch) void supabase.removeChannel(ch)
    }
  }, [orgId])

  // Auto-scroll on new messages or thread switch
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [selectedKey, localMessages.length])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return
    const content = newMessage.trim()
    const type = messageType
    setNewMessage('')
    setSending(true)
    setSendError(null)

    // Réutilise le chemin de mutation existant : message indexé par project_id,
    // thread_id optionnel (comme la messagerie de la fiche chantier).
    const { data, error } = await mutationClient()
      .from('messages')
      .insert({
        org_id: orgId,
        project_id: selectedConversation.projectId,
        thread_id: selectedConversation.threadId,
        sender_id: currentUserId,
        content,
        type,
      })
      .select('*')
      .single()

    setSending(false)
    if (error) { setSendError(error.message); setNewMessage(content); return }
    setMessageType('text')

    if (data) {
      setLocalMessages(prev =>
        prev.some(m => m.id === data.id) ? prev : [data, ...prev]
      )
    }
  }

  const isTypedMessage = (type: MessageType) => type !== 'text'

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* ── Left column: thread list ── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-surface h-full">
        <div className="p-3 border-b border-border flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-elevated border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowNewThread(true)}
            className="flex items-center gap-1.5 text-xs font-600 text-primary hover:text-primary/80 transition-colors px-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(({ c, last }) => {
            const isActive = selectedConversation?.key === c.key
            // Sans modèle de « lu » en base : indicateur d'activité récente (48h,
            // messages non émis par l'utilisateur) — même sémantique que le badge nav.
            const recent = localMessages.filter(m =>
              ((c.threadId && m.thread_id === c.threadId) || (c.projectId && m.project_id === c.projectId)) &&
              m.sender_id !== currentUserId &&
              Date.now() - new Date(m.created_at).getTime() < 48 * 3600 * 1000
            ).length

            return (
              <button
                key={c.key}
                onClick={() => setSelectedKey(c.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border transition-colors',
                  isActive ? 'bg-primary/8 border-l-2 border-l-primary pl-[14px]' : 'hover:bg-elevated'
                )}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-700 shrink-0"
                  style={{ background: c.color }}
                >
                  {getInitials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-600 text-foreground truncate">{c.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {last && (
                        <span className="text-[10px] text-muted-foreground">{formatRelative(last.created_at)}</span>
                      )}
                      {recent > 0 && !isActive && (
                        <span className="min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-700 flex items-center justify-center px-1 leading-none tabular-nums">
                          {recent}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {last
                      ? `${isTypedMessage(last.type) ? `[${messageTypeLabel(last.type)}] ` : ''}${last.content}`
                      : 'Aucun message'}
                  </p>
                </div>
              </button>
            )
          })}

          {filteredConversations.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? 'Aucun résultat' : 'Aucun chantier'}
            </div>
          )}
        </div>
      </div>

      {/* ── Center column: chat ── */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border bg-surface">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-700 shrink-0"
              style={{ background: selectedConversation.color }}
            >
              {getInitials(selectedConversation.name)}
            </div>
            <div className="min-w-0">
              <p className="font-700 text-foreground text-sm truncate">
                {selectedConversation.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedConversation.projectId ? 'Messagerie chantier' : 'Conversation directe'}
              </p>
            </div>
          </div>

          {/* Messages feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-1">
            {threadMessages.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Aucun message dans cette conversation</p>
                  <p className="text-xs mt-1 opacity-60">Soyez le premier à envoyer un message</p>
                </div>
              </div>
            )}

            {[...threadMessages].reverse().map((msg, i, arr) => {
              const isMine = msg.sender_id === currentUserId
              const typed = isTypedMessage(msg.type)
              const prevMsg = arr[i - 1]
              const nextMsg = arr[i + 1]
              const showSender = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id)
              const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id

              return (
                <div key={msg.id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start', isLastInGroup ? 'mb-2' : 'mb-0.5')}>
                  {showSender && (
                    <span className="text-[11px] font-600 text-muted-foreground mb-1 px-1">
                      {(msg.sender as any)?.full_name ?? 'Inconnu'}
                    </span>
                  )}

                  {typed ? (
                    // Typed message card
                    <div className={cn(
                      'max-w-[72%] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm',
                      isMine && 'self-end'
                    )}>
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-2 text-[11px] font-700 uppercase tracking-wide border-b border-border',
                        messageTypeColor(msg.type)
                      )}>
                        <span>{messageTypeLabel(msg.type)}</span>
                      </div>
                      <div className="px-3 py-2.5 text-sm text-foreground leading-relaxed">{msg.content}</div>
                      <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
                        {!isMine && (
                          <span className="text-[10px] text-muted-foreground">{(msg.sender as any)?.full_name ?? ''}</span>
                        )}
                        <span className={cn('text-[10px] text-muted-foreground', isMine && 'ml-auto')}>{formatRelative(msg.created_at)}</span>
                      </div>
                    </div>
                  ) : (
                    // Plain bubble
                    <div className={cn(
                      'max-w-[68%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                      isMine ? 'bubble-mine rounded-br-sm' : 'bubble-other rounded-bl-sm'
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
          <div className="shrink-0 px-4 py-3 border-t border-border bg-surface">
            {/* Type selector */}
            <div className="flex gap-1.5 mb-2.5 flex-wrap">
              {SEND_TYPES.map(mt => (
                <button
                  key={mt.type}
                  onClick={() => setMessageType(mt.type)}
                  className={cn(
                    'text-[11px] px-2.5 py-1 rounded-full font-600 border transition-all',
                    messageType === mt.type
                      ? mt.type === 'text'
                        ? 'bg-primary text-white border-primary'
                        : cn(messageTypeColor(mt.type), 'border-current')
                      : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
                  )}
                >
                  {mt.label}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2 bg-elevated border border-border rounded-2xl px-3 py-2 focus-within:border-primary transition-colors">
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={messageType === 'text' ? 'Votre message...' : `${messageTypeLabel(messageType)}...`}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
                rows={1}
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0 transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {sendError && (
              <p className="text-xs text-destructive mt-1">{sendError}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm mb-3">Sélectionnez une conversation</p>
            <button
              onClick={() => setShowNewThread(true)}
              className="text-xs text-primary hover:underline font-500 flex items-center gap-1 mx-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Créer une conversation
            </button>
          </div>
        </div>
      )}

      {/* ── Right column: context panel (desktop only) ── */}
      <ContextPanel
        project={panelProject}
        tasks={panelTasks as any}
        documents={panelDocs}
        photos={panelPhotos}
        issues={panelIssues as any}
      />

      {showNewThread && (
        <NouvelleConversationModal
          orgId={orgId}
          currentUserId={currentUserId}
          projects={projects}
          onClose={() => setShowNewThread(false)}
          onCreated={(id) => setSelectedKey(`thread:${id}`)}
        />
      )}
    </div>
  )
}
