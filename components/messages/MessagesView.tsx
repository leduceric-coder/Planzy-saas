'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Plus, Search, MessageSquare } from 'lucide-react'
import { cn, formatRelative, getInitials, messageTypeLabel, messageTypeColor } from '@/lib/utils'
import type { Message, Profile } from '@/lib/types'

const MESSAGE_TYPES = [
  { type: 'text', label: 'Message' },
  { type: 'consigne', label: 'Consigne' },
  { type: 'probleme', label: 'Problème' },
  { type: 'question', label: 'Question' },
  { type: 'tache_terminee', label: 'Tâche terminée' },
  { type: 'validation_demandee', label: 'Validation' },
  { type: 'livraison_absente', label: 'Livraison absente' },
]

interface Thread {
  id: string
  title: string | null
  type: string
  project?: { id: string; name: string; color: string } | null
  created_at: string
}

interface Props {
  threads: Thread[]
  messages: (Message & { sender?: Profile | null })[]
  currentUserId: string
  profile: Profile | null
}

export function MessagesView({ threads, messages, currentUserId, profile }: Props) {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(threads[0] ?? null)
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState('text')
  const [search, setSearch] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  const threadMessages = messages.filter(m =>
    selectedThread ? m.thread_id === selectedThread.id || m.project_id === selectedThread.project?.id : false
  )

  const filteredThreads = threads.filter(t =>
    !search || (t.title ?? t.project?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [selectedThread])

  const handleSend = () => {
    if (!newMessage.trim()) return
    // In production: call Supabase insert
    setNewMessage('')
    setMessageType('text')
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Conversations list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-surface h-full">
        {/* Search */}
        <div className="p-3 border-b border-border">
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
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.map(thread => {
            const lastMsg = messages.find(m => m.thread_id === thread.id || m.project_id === thread.project?.id)
            const isActive = selectedThread?.id === thread.id

            return (
              <button
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border transition-colors',
                  isActive ? 'bg-primary/8 border-l-2 border-l-primary pl-[14px]' : 'hover:bg-elevated'
                )}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-700 shrink-0"
                  style={{ background: thread.project?.color ?? '#2563EB' }}
                >
                  {getInitials(thread.title ?? thread.project?.name ?? 'CH')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-600 text-foreground truncate">
                      {thread.title ?? thread.project?.name ?? 'Conversation'}
                    </span>
                    {lastMsg && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatRelative(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-muted-foreground truncate">{lastMsg.content}</p>
                  )}
                </div>
              </button>
            )
          })}

          {filteredThreads.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aucune conversation
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border bg-surface">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-700"
              style={{ background: selectedThread.project?.color ?? '#2563EB' }}
            >
              {getInitials(selectedThread.title ?? selectedThread.project?.name ?? 'CH')}
            </div>
            <div>
              <p className="font-700 text-foreground text-sm">
                {selectedThread.title ?? selectedThread.project?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedThread.type === 'project' ? 'Messagerie chantier' : 'Conversation'}
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
                </div>
              </div>
            )}

            {threadMessages.map((msg, i) => {
              const isMine = msg.sender_id === currentUserId
              const isTyped = msg.type !== 'text'
              const prevMsg = threadMessages[i - 1]
              const showSender = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id)

              return (
                <div key={msg.id} className={cn('flex flex-col mb-0.5', isMine ? 'items-end' : 'items-start')}>
                  {showSender && (
                    <span className="text-[11px] font-600 text-muted-foreground mb-1 px-1">
                      {msg.sender?.full_name ?? 'Inconnu'}
                    </span>
                  )}

                  {isTyped ? (
                    <div className={cn('max-w-[72%] rounded-xl overflow-hidden border border-border bg-surface', isMine && 'self-end')}>
                      <div className={cn('flex items-center gap-2 px-3 py-2 text-[11px] font-700 uppercase tracking-wide border-b border-border', messageTypeColor(msg.type))}>
                        {messageTypeLabel(msg.type)}
                      </div>
                      <div className="px-3 py-2.5 text-sm text-foreground">{msg.content}</div>
                      <div className="px-3 pb-2 text-[10px] text-muted-foreground">{formatRelative(msg.created_at)}</div>
                    </div>
                  ) : (
                    <div className={cn('max-w-[68%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed', isMine ? 'bubble-mine' : 'bubble-other')}>
                      {msg.content}
                      <div className={cn('text-[10px] mt-1', isMine ? 'text-white/60 text-right' : 'text-muted-foreground')}>
                        {formatRelative(msg.created_at)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Send bar */}
          <div className="shrink-0 px-4 py-3 border-t border-border bg-surface">
            {/* Message type selector */}
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {MESSAGE_TYPES.map(mt => (
                <button
                  key={mt.type}
                  onClick={() => setMessageType(mt.type)}
                  className={cn(
                    'text-[11px] px-2.5 py-1 rounded-full font-600 border transition-all',
                    messageType === mt.type
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-muted-foreground hover:border-border-strong'
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
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={messageType === 'text' ? 'Votre message...' : `${messageTypeLabel(messageType)}...`}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim()}
                className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0 transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        </div>
      )}
    </div>
  )
}
