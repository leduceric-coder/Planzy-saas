'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Paperclip, MessageCircle, ArrowRight, Plus, Flag, Camera, Circle } from 'lucide-react'
import { cn, formatRelative, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { mutationClient } from '@/lib/supabase/mutate'
import type { Message, MessageType } from '@/lib/types'
import Link from 'next/link'

interface Thread {
  id: string
  title: string | null
  type: string
  project?: { id: string; name: string; color: string } | null
  created_at: string
}

type MsgRow = Omit<Message, 'sender'> & {
  sender?: { id: string; full_name: string | null } | null
}

interface Props {
  orgId: string
  currentUserId: string
  onClose: () => void
  initialProjectId?: string | null
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

const TYPE_META: Record<string, { label: string; pill: string }> = {
  probleme:            { label: 'Problème',   pill: 'bg-red-100   dark:bg-red-900/40   text-red-700   dark:text-red-300' },
  validation_demandee: { label: 'Validation', pill: 'bg-blue-100  dark:bg-blue-900/40  text-blue-700  dark:text-blue-300' },
  consigne:            { label: 'Consigne',   pill: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  question:            { label: 'Question',   pill: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  tache_terminee:      { label: 'Terminé',    pill: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
}

export function DashboardMessagesPanel({
  orgId,
  currentUserId,
  onClose,
  initialProjectId,
}: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isClosing, setIsClosing] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  function handleClose() {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => onClose(), 240)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: threadsData }, { data: msgsData }] = await Promise.all([
        supabase
          .from('message_threads')
          .select('*, project:projects(id,name,color)')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(id,full_name)')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true })
          .limit(300),
      ])
      if (cancelled) return

      const tList = (threadsData ?? []) as Thread[]
      setThreads(tList)
      setMessages((msgsData ?? []) as MsgRow[])

      if (initialProjectId) {
        const match = tList.find(t => t.project?.id === initialProjectId)
        setSelectedId(match?.id ?? tList[0]?.id ?? null)
      } else {
        setSelectedId(tList[0]?.id ?? null)
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, initialProjectId])

  // Scroll feed to bottom on thread change
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [selectedId, messages.length])

  const selectedThread = threads.find(t => t.id === selectedId) ?? null
  const threadMessages = messages.filter(m => m.thread_id === selectedId)

  const headerTitle = selectedThread
    ? (selectedThread.title ?? selectedThread.project?.name ?? 'Conversation')
    : null
  const headerSub = selectedThread
    ? (selectedThread.project?.name && selectedThread.title
        ? selectedThread.project.name
        : 'Fil de discussion')
    : null

  async function handleSend() {
    if (!newMsg.trim() || !selectedId || sending) return
    setSending(true)
    const mc = mutationClient()
    await mc.from('messages').insert({
      content: newMsg.trim(),
      type: 'text' as MessageType,
      thread_id: selectedId,
      project_id: selectedThread?.project?.id ?? null,
      org_id: orgId,
      sender_id: currentUserId,
    })
    setNewMsg('')
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id,full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(300)
    if (data) setMessages(data as MsgRow[])
    setSending(false)
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/35 backdrop-blur-[3px] z-[199]',
          isClosing ? 'backdrop-exit' : 'backdrop-enter',
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[200] flex bg-surface border-l border-border/50 shadow-[−8px_0_40px_rgba(0,0,0,0.18)]',
          isClosing ? 'task-panel-exit' : 'task-panel-enter',
        )}
        style={{ width: 'min(540px, 96vw)' }}
      >

        {/* ── Thread list (left column) ── */}
        <div className="flex flex-col border-r border-border/40 bg-surface" style={{ width: 200 }}>

          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-[12px] font-800 uppercase tracking-widest text-slate-700 dark:text-slate-200">Messages</span>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-border/40 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center">
                <div className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">Aucune conversation</p>
              </div>
            ) : (
              threads.map(thread => {
                const isSelected = thread.id === selectedId
                const name = thread.title ?? thread.project?.name ?? 'Conversation'
                const lastMsg = messages.filter(m => m.thread_id === thread.id).at(-1)
                const time = lastMsg ? formatRelative(lastMsg.created_at) : null
                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedId(thread.id)}
                    className={cn(
                      'w-full text-left px-3 py-3.5 border-b border-border/20 transition-colors',
                      isSelected
                        ? 'bg-primary/[0.10] border-l-[3px] border-l-primary pl-2.5'
                        : 'hover:bg-foreground/[0.02]',
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0 mb-0.5">
                      {/* Color dot avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-700 shrink-0 mt-0.5"
                        style={{ background: thread.project?.color ?? '#6366f1' }}
                      >
                        {getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12px] font-700 text-slate-800 dark:text-slate-100 truncate">{name}</span>
                          {time && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">{time}</span>
                          )}
                        </div>
                        {lastMsg && (
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate leading-snug mt-0.5">
                            {lastMsg.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-3 py-3 border-t border-border/40">
            <Link
              href="/messages"
              onClick={onClose}
              className="flex items-center gap-1 text-[11px] text-primary font-700 hover:text-primary/80 transition-colors"
            >
              Vue complète <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>

        {/* ── Conversation area (right) ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Conv header */}
          <div className="shrink-0 px-4 py-3.5 border-b border-border/40 bg-surface">
            {selectedThread ? (
              <div className="flex items-center gap-3">
                {/* Project avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-700 shrink-0"
                  style={{ background: selectedThread.project?.color ?? '#6366f1' }}
                >
                  {getInitials(headerTitle ?? '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-700 text-slate-800 dark:text-slate-100 truncate leading-tight">
                    {headerTitle}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {headerSub}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-slate-400 italic">Sélectionnez une conversation</p>
            )}
          </div>

          {/* Messages feed — WhatsApp-like background */}
          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 messages-bg"
          >
            {loading ? null : !selectedId ? (
              <div className="flex-1 flex items-center justify-center mt-20">
                <p className="text-xs text-slate-400">Aucune conversation sélectionnée</p>
              </div>
            ) : threadMessages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center mt-20">
                <p className="text-xs text-slate-400">Aucun message dans cette conversation.</p>
              </div>
            ) : (
              threadMessages.map(msg => {
                const isMe = msg.sender_id === currentUserId
                const senderName = msg.sender?.full_name ?? 'Équipe'
                const initials = getInitials(senderName)
                const color = avatarColor(senderName)
                const meta = msg.type !== 'text' ? (TYPE_META[msg.type] ?? null) : null

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-2',
                      isMe ? 'flex-row-reverse self-end max-w-[78%]' : 'self-start max-w-[78%]',
                    )}
                  >
                    {!isMe && (
                      <div
                        className="w-8 h-8 rounded-full text-white text-[10px] font-700 flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                        style={{ background: color }}
                      >
                        {initials}
                      </div>
                    )}
                    <div className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                      {!isMe && (
                        <p className="text-[11px] font-700 mb-1 ml-1" style={{ color }}>
                          {senderName}
                        </p>
                      )}
                      {/* Type badge */}
                      {meta && (
                        <span className={cn('text-[9.5px] font-700 px-2 py-0.5 rounded-full mb-1.5 border border-black/[0.06]', meta.pill)}>
                          {meta.label}
                        </span>
                      )}
                      <div
                        className={cn(
                          'px-4 py-2.5 text-[13px] leading-relaxed',
                          isMe
                            ? 'bg-[#25d366] dark:bg-[#128c7e] text-white rounded-2xl rounded-tr-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.22)]'
                            : 'bg-white dark:bg-[#1f2c34] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.10)] border border-black/[0.06] dark:border-white/[0.07]',
                        )}
                      >
                        {msg.content}
                      </div>
                      <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 mx-1 select-none">
                        {formatRelative(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Quick actions + input bar */}
          <div className="shrink-0 border-t border-border/40 bg-surface">
            {/* Quick actions */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
              <Link
                href="/planning"
                onClick={onClose}
                className="flex items-center gap-1.5 text-[10.5px] font-700 text-muted-foreground hover:text-primary px-3 py-1.5 rounded-lg bg-elevated/50 hover:bg-primary/10 transition-all border border-border/40 hover:border-primary/30"
              >
                <Plus className="h-3 w-3" /> Tâche
              </Link>
              <button
                disabled
                title="Bientôt disponible"
                className="flex items-center gap-1.5 text-[10.5px] font-600 text-muted-foreground/50 px-3 py-1.5 rounded-lg bg-elevated/40 border border-border/30 cursor-not-allowed opacity-55"
              >
                <Flag className="h-3 w-3" /> Réserve
              </button>
              <button
                disabled
                title="Bientôt disponible"
                className="flex items-center gap-1.5 text-[10.5px] font-600 text-muted-foreground/50 px-3 py-1.5 rounded-lg bg-elevated/40 border border-border/30 cursor-not-allowed opacity-55"
              >
                <Camera className="h-3 w-3" /> Photo
              </button>
            </div>
            {/* Input */}
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-elevated/40 border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all shadow-sm">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                    }}
                    placeholder="Écrire un message…"
                    className="flex-1 text-[13px] bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    disabled={!selectedId || sending}
                  />
                  <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0 cursor-pointer hover:text-slate-600 transition-colors" />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!newMsg.trim() || !selectedId || sending}
                  className="w-11 h-11 rounded-2xl bg-[#25d366] hover:bg-[#20c45e] transition-colors flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(37,211,102,0.4)]"
                >
                  <Send className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
