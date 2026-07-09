'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckSquare, MessageSquare, Camera, User,
  Check, ChevronDown, ChevronUp, ChevronRight, X, Send,
  AlertTriangle, Building2, ExternalLink, LogOut,
  Sun, Moon, Monitor, Play,
} from 'lucide-react'
import { cn, taskStatusColor, taskStatusLabel, formatDate, formatRelative } from '@/lib/utils'
import { mutationClient } from '@/lib/supabase/mutate'
import { createClient } from '@/lib/supabase/client'
import { useTheme, type Theme } from '@/components/layout/ThemeProvider'
import type { Task, Message, Issue, Profile, Artisan, Project } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'today' | 'chantiers' | 'messages' | 'photos' | 'profil'

type TaskWithProject = Task & { project?: { id: string; name: string; color: string } | null }
type MessageWithMeta = Message & { sender?: Profile | null; project?: { name: string; color: string } | null }
type IssueWithProject = Issue & { project?: { id: string; name: string } | null }
type ProjectRow = Pick<Project, 'id' | 'org_id' | 'name' | 'color' | 'status' | 'progress'>

interface Props {
  profile: Profile | null
  artisan: Artisan | null
  tasks: TaskWithProject[]
  doneTasks: TaskWithProject[]
  messages: MessageWithMeta[]
  issues: IssueWithProject[]
  projects: ProjectRow[]
  orgId: string | null
  currentUserId: string
  isUnlinkedField?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MSG_TYPES = [
  { type: 'tache_terminee',    label: 'Tâche terminée',   emoji: '✅' },
  { type: 'probleme',          label: 'Problème',          emoji: '🚨' },
  { type: 'livraison_absente', label: 'Livraison absente', emoji: '📦' },
  { type: 'question',          label: 'Question',          emoji: '❓' },
  { type: 'validation_demandee', label: 'Validation',      emoji: '🔍' },
] as const

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible', medium: 'Normale', high: 'Haute', critical: 'Critique',
}
const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert', assigned: 'Assigné', in_progress: 'En cours',
  fixed: 'Résolu', validated: 'Validé', rejected: 'Rejeté',
}
const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire', admin: 'Administrateur', manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux', artisan: 'Artisan', viewer: 'Lecteur',
}

const TAB_META: { id: Tab; label: string; title: string; icon: React.ElementType }[] = [
  { id: 'today',     label: "Auj.",    title: "Aujourd'hui",      icon: CheckSquare  },
  { id: 'chantiers', label: 'Chantiers', title: 'Mes chantiers',  icon: Building2    },
  { id: 'messages',  label: 'Messages',  title: 'Messages',       icon: MessageSquare },
  { id: 'photos',    label: 'Photos',    title: 'Photos & Réserves', icon: Camera    },
  { id: 'profil',    label: 'Profil',    title: 'Profil',          icon: User         },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUrgentTask(task: TaskWithProject, today: Date): boolean {
  if (task.priority === 'high' || task.priority === 'critical') return true
  if (task.status === 'blocked') return true
  if (task.end_date && new Date(task.end_date) < today) return true
  return false
}

// ─── MobileTaskDetailSheet ────────────────────────────────────────────────────

function MobileTaskDetailSheet({ task, onClose }: { task: TaskWithProject; onClose: () => void }) {
  const today = new Date()
  const isLate = !!(task.end_date && new Date(task.end_date) < today && task.status !== 'done' && task.status !== 'validated')
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-t-3xl flex flex-col pb-safe max-h-[85vh]">
        {/* Handle */}
        <div className="shrink-0 flex flex-col items-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-4">
          {/* Title */}
          <h2 className="text-lg font-700 text-foreground leading-snug">{task.title}</h2>

          {/* Project */}
          {task.project && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: task.project.color }} />
              <span className="text-sm font-600 text-foreground">{task.project.name}</span>
            </div>
          )}

          {/* Status + Priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-600', taskStatusColor(task.status))}>
              {taskStatusLabel(task.status)}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full font-600 bg-muted text-muted-foreground capitalize">
              {PRIORITY_LABELS[task.priority] ?? task.priority}
            </span>
          </div>

          {/* Dates */}
          {(task.start_date || task.end_date) && (
            <div className="bg-elevated border border-border rounded-xl px-4 py-3 flex flex-col gap-2">
              {task.start_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Début</span>
                  <span className="text-xs font-600 text-foreground">{formatDate(task.start_date)}</span>
                </div>
              )}
              {task.end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Échéance</span>
                  <span className={cn('text-xs font-600', isLate ? 'text-destructive' : 'text-foreground')}>
                    {isLate ? '⚠ ' : ''}{formatDate(task.end_date)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {task.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="w-full h-12 bg-muted text-foreground rounded-xl font-700 text-sm active:scale-[0.98] transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components (defined outside to avoid React remount on re-render) ─────

interface TaskCardProps {
  task: TaskWithProject
  isDone: boolean
  isTodo: boolean
  loading: boolean
  today: Date
  onMarkDone: (id: string) => void
  onMarkInProgress?: (id: string) => void
  onQuickSignal?: (taskId: string, projectId: string) => void
  onQuickPhoto?: (task: TaskWithProject) => void
  onShowDetail?: (task: TaskWithProject) => void
}

function TaskCard({ task, isDone, isTodo, loading, today, onMarkDone, onMarkInProgress, onQuickSignal, onQuickPhoto, onShowDetail }: TaskCardProps) {
  const isLate = !!(task.end_date && new Date(task.end_date) < today)
  const isUrgent = !isDone && isUrgentTask(task, today)

  return (
    <div
      className={cn(
        'bg-surface border rounded-2xl p-4 flex gap-3 transition-opacity',
        isDone    ? 'opacity-50 border-border'
        : isUrgent ? 'border-destructive/45'
        :            'border-border',
      )}
      style={isUrgent ? { boxShadow: '0 8px 24px rgba(239,68,68,0.22)' } : undefined}
    >
      {/* Checkbox */}
      <button
        onClick={() => !isDone && !loading && onMarkDone(task.id)}
        disabled={isDone || loading}
        aria-label="Marquer terminée"
        className={cn(
          'mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90',
          isDone        ? 'border-green-500 bg-green-500 text-white'
          : isLate      ? 'border-destructive'
          :               'border-border',
        )}
      >
        {isDone && <Check className="h-3 w-3" />}
        {loading && !isDone && <span className="w-2 h-2 rounded-full border border-current animate-spin" />}
      </button>

      {/* Body — tap to open detail */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onShowDetail?.(task)}>
        <p className={cn('text-sm font-600 leading-snug', isDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
          {task.title}
        </p>
        {task.project && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.project.color }} />
            <span className="text-xs text-muted-foreground truncate">{task.project.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-600', taskStatusColor(task.status))}>
            {taskStatusLabel(task.status)}
          </span>
          {task.end_date && (
            <span className={cn('text-[10px] font-600', isLate ? 'text-destructive' : 'text-muted-foreground')}>
              {isLate ? '⚠ ' : ''}{formatDate(task.end_date)}
            </span>
          )}
        </div>

        {/* Quick action chips — stopPropagation to avoid triggering detail sheet */}
        {!isDone && (
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={e => { e.stopPropagation(); onQuickSignal?.(task.id, task.project_id) }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-destructive/10 text-destructive font-600 active:scale-95 transition-all"
              aria-label="Signaler une réserve"
            >
              <AlertTriangle className="h-2.5 w-2.5" /> Signaler
            </button>
            {task.project_id && (
              <button
                onClick={e => { e.stopPropagation(); onQuickPhoto?.(task) }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground font-600 active:scale-95 transition-all"
                aria-label="Ajouter une photo"
              >
                <Camera className="h-2.5 w-2.5" /> Photo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main action button */}
      {!isDone && (
        <div className="shrink-0 self-center">
          {isTodo ? (
            <button
              onClick={() => onMarkInProgress?.(task.id)}
              disabled={loading}
              className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-700 bg-muted text-foreground flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? '…' : <><Play className="h-3 w-3 fill-current" />Démarrer</>}
            </button>
          ) : (
            <button
              onClick={() => onMarkDone(task.id)}
              disabled={loading}
              className={cn(
                'min-h-[40px] px-3 py-2 rounded-xl text-xs font-700 transition-all active:scale-95 disabled:opacity-50',
                isUrgent ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
              )}
            >
              {loading ? '…' : 'Terminer'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface TaskSectionProps {
  title: string
  colorClass?: string
  tasks: TaskWithProject[]
  doneIds: Set<string>
  inProgressIds: Set<string>
  taskLoading: string | null
  today: Date
  onMarkDone: (id: string) => void
  onMarkInProgress?: (id: string) => void
  onQuickSignal?: (taskId: string, projectId: string) => void
  onQuickPhoto?: (task: TaskWithProject) => void
  onShowDetail?: (task: TaskWithProject) => void
}

function TaskSection({ title, colorClass, tasks, doneIds, inProgressIds, taskLoading, today, onMarkDone, onMarkInProgress, onQuickSignal, onQuickPhoto, onShowDetail }: TaskSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  if (tasks.length === 0) return null

  const activeCount = tasks.filter(t => !doneIds.has(t.id) && t.status !== 'done' && t.status !== 'validated').length

  return (
    <div className="mx-4 mt-4">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 mb-2 w-full"
      >
        <span className={cn('text-xs font-700 uppercase tracking-wider', colorClass ?? 'text-muted-foreground')}>
          {title}
        </span>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded-full font-700',
          colorClass ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
        )}>
          {activeCount}
        </span>
        <span className="ml-auto text-muted-foreground">
          {collapsed
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronUp   className="h-3.5 w-3.5" />}
        </span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-2">
          {tasks.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              isDone={doneIds.has(t.id) || t.status === 'done' || t.status === 'validated'}
              isTodo={t.status === 'todo' && !inProgressIds.has(t.id) && !doneIds.has(t.id)}
              loading={taskLoading === t.id}
              today={today}
              onMarkDone={onMarkDone}
              onMarkInProgress={onMarkInProgress}
              onQuickSignal={onQuickSignal}
              onQuickPhoto={onQuickPhoto}
              onShowDetail={onShowDetail}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Done section (read-only, no actions) ────────────────────────────────────

function DoneSection({ tasks, today, onShowDetail }: { tasks: TaskWithProject[]; today: Date; onShowDetail?: (task: TaskWithProject) => void }) {
  const [collapsed, setCollapsed] = useState(false)
  if (tasks.length === 0) return null
  return (
    <div className="mx-4 mt-4">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 mb-2 w-full"
      >
        <span className="text-xs font-700 uppercase tracking-wider text-green-500">Terminées aujourd'hui</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-700 bg-green-500/10 text-green-500">{tasks.length}</span>
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-2">
          {tasks.map(t => (
            <button
              key={t.id}
              onClick={() => onShowDetail?.(t)}
              className="w-full bg-surface border border-border rounded-2xl p-4 flex gap-3 opacity-60 active:opacity-80 active:scale-[0.99] transition-all text-left"
            >
              <div className="mt-0.5 w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 text-white flex items-center justify-center shrink-0">
                <Check className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-600 leading-snug line-through text-muted-foreground">{t.title}</p>
                {t.project && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.project.color }} />
                    <span className="text-xs text-muted-foreground truncate">{t.project.name}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MobileArtisanView({
  profile, artisan, tasks, doneTasks, messages, issues, projects, orgId, currentUserId, isUnlinkedField = false,
}: Props) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('today')
  const [toastState, setToastState] = useState<{ text: string; err?: boolean } | null>(null)

  const showToast = useCallback((text: string, variant?: 'error') => {
    setToastState({ text, err: variant === 'error' })
    setTimeout(() => setToastState(null), 3000)
  }, [])

  // Today
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(new Set())
  const [taskLoading, setTaskLoading] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null)

  // Messages
  const [localMessages, setLocalMessages] = useState<MessageWithMeta[]>(messages)
  const [msgContent, setMsgContent] = useState('')
  const [msgType, setMsgType] = useState('text')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const generalThreadIdRef = useRef<string | null>(null)

  // Photos
  const [photoProjectId, setPhotoProjectId] = useState(projects[0]?.id ?? '')
  // Task linked to the photo being uploaded (set via "Photo" chip on task card)
  const [photoLinkedTask, setPhotoLinkedTask] = useState<{ id: string; title: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoFormRef = useRef<HTMLDivElement>(null)

  // Reserve form
  const [showReserveForm, setShowReserveForm] = useState(false)
  const [reserveProjectId, setReserveProjectId] = useState(projects[0]?.id ?? '')
  const [reserveTitle, setReserveTitle] = useState('')
  const [reserveDesc, setReserveDesc] = useState('')
  const [reservePriority, setReservePriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [reserveLoading, setReserveLoading] = useState(false)

  const [localPhotos, setLocalPhotos] = useState<Array<{ id: string; signedUrl: string; projectName: string; taskTitle?: string }>>([])
  const [localIssues, setLocalIssues] = useState<IssueWithProject[]>(issues)

  // Computed values
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  // "En cours" — server in_progress + just-started via Démarrer
  const inProgressTasks = useMemo(() =>
    tasks.filter(t => (t.status === 'in_progress' || inProgressIds.has(t.id)) && !doneIds.has(t.id)),
  [tasks, inProgressIds, doneIds])

  // Other sections exclude in_progress tasks to prevent duplicates
  const lateTasks = useMemo(() =>
    tasks.filter(t => {
      if (doneIds.has(t.id) || t.status === 'in_progress' || inProgressIds.has(t.id)) return false
      return !!t.end_date && new Date(t.end_date) < today
    }),
  [tasks, today, doneIds, inProgressIds])

  const todayTasks = useMemo(() =>
    tasks.filter(t => {
      if (doneIds.has(t.id) || t.status === 'in_progress' || inProgressIds.has(t.id) || !t.end_date) return false
      const d = new Date(t.end_date); d.setHours(0, 0, 0, 0)
      return d.getTime() === today.getTime()
    }),
  [tasks, today, doneIds, inProgressIds])

  const upcomingTasks = useMemo(() =>
    tasks.filter(t => {
      if (doneIds.has(t.id) || t.status === 'in_progress' || inProgressIds.has(t.id) || !t.end_date) return false
      const d = new Date(t.end_date); d.setHours(0, 0, 0, 0)
      return d > today && d <= new Date(today.getTime() + 7 * 86400000)
    }),
  [tasks, today, doneIds, inProgressIds])

  const undatedTasks = useMemo(() =>
    tasks.filter(t => {
      if (doneIds.has(t.id) || t.status === 'in_progress' || inProgressIds.has(t.id)) return false
      return !t.end_date
    }),
  [tasks, doneIds, inProgressIds])

  // Terminées aujourd'hui = union (dédupliquée) des tâches terminées localement + celles fetchées depuis la DB
  const recentlyDoneTasks = useMemo(() => {
    const seen = new Set<string>()
    const result: TaskWithProject[] = []
    // Local first (plus récentes)
    for (const t of tasks) {
      if (doneIds.has(t.id) && !seen.has(t.id)) { seen.add(t.id); result.push(t) }
    }
    // Server done tasks (persistées après refresh)
    for (const t of doneTasks) {
      if (!seen.has(t.id)) { seen.add(t.id); result.push(t) }
    }
    return result
  }, [tasks, doneIds, doneTasks])

  // Per-project task/issue counts (computed from already-fetched data)
  const tasksByProject = useMemo(() => {
    const m: Record<string, number> = {}
    tasks.forEach(t => { m[t.project_id] = (m[t.project_id] ?? 0) + 1 })
    return m
  }, [tasks])

  const issuesByProject = useMemo(() => {
    const m: Record<string, number> = {}
    issues.forEach(i => { if (i.project_id) m[i.project_id] = (m[i.project_id] ?? 0) + 1 })
    return m
  }, [issues])

  const urgentLate = lateTasks.length

  // Account identity: always the logged-in user, never the linked artisan
  const accountDisplayName = profile?.full_name ?? profile?.email ?? 'Vous'
  const initials = accountDisplayName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
  const avatarColor = artisan?.color ?? '#2563EB'

  // Realtime subscription for messages.
  // IMPORTANT: with @supabase/ssr, the JWT is read from cookies asynchronously.
  // We must await getSession() + call realtime.setAuth() BEFORE subscribing,
  // otherwise the channel joins without a token → auth.uid()=null → RLS blocks all events.
  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()
    const channelName = `mobile-messages-${orgId.slice(0, 8)}`
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

  // Scroll messages to bottom when switching to tab or when new messages arrive
  useEffect(() => {
    if (tab === 'messages') {
      const t = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      return () => clearTimeout(t)
    }
  }, [tab, localMessages.length])

  // Scroll photo form into view when arriving via quick photo
  useEffect(() => {
    if (tab === 'photos' && photoLinkedTask) {
      const t = setTimeout(() => photoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
      return () => clearTimeout(t)
    }
  }, [tab, photoLinkedTask])

  useEffect(() => { setLocalIssues(issues) }, [issues])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleMarkDone = useCallback(async (taskId: string) => {
    if (taskLoading || doneIds.has(taskId)) return
    setTaskLoading(taskId)
    const { error } = await mutationClient().from('tasks').update({
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', taskId)
    setTaskLoading(null)
    if (error) { showToast(error.message, 'error'); return }
    setDoneIds(prev => new Set([...prev, taskId]))
    // Remove from inProgressIds if it was there
    setInProgressIds(prev => { const next = new Set(prev); next.delete(taskId); return next })
    showToast('Tâche terminée ✓')
    router.refresh()
  }, [taskLoading, doneIds, router, showToast])

  const handleMarkInProgress = useCallback(async (taskId: string) => {
    if (taskLoading || inProgressIds.has(taskId) || doneIds.has(taskId)) return
    setTaskLoading(taskId)
    const { error } = await mutationClient().from('tasks').update({ status: 'in_progress' }).eq('id', taskId)
    setTaskLoading(null)
    if (error) { showToast(error.message, 'error'); return }
    setInProgressIds(prev => new Set([...prev, taskId]))
    showToast('Tâche démarrée ✓')
    router.refresh()
  }, [taskLoading, inProgressIds, doneIds, router, showToast])

  const handleQuickSignal = useCallback((taskId: string, projectId: string) => {
    const task = tasks.find(t => t.id === taskId)
    setReserveProjectId(projectId || projects[0]?.id || '')
    setReserveTitle(task ? `Réserve — ${task.title}` : '')
    setReserveDesc('')
    setReservePriority('medium')
    setShowReserveForm(true)
    setTab('photos')
  }, [tasks, projects])

  const handleQuickPhoto = useCallback((task: TaskWithProject) => {
    if (task.project_id) setPhotoProjectId(task.project_id)
    setPhotoLinkedTask({ id: task.id, title: task.title })
    setTab('photos')
  }, [])

  const handleClearPhotoTask = useCallback(() => {
    setPhotoLinkedTask(null)
  }, [])

  const handleShowDetail = useCallback((task: TaskWithProject) => {
    setSelectedTask(task)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedTask(null)
  }, [])

  const handleSendMessage = useCallback(async () => {
    if (!msgContent.trim() || sending || !orgId) return
    const content = msgContent.trim()
    const type = msgType === 'text' ? 'text' : msgType
    setMsgContent('')
    setMsgType('text')
    setSending(true)

    // Get or create the "Général" thread for this org (cached in ref across sends).
    if (!generalThreadIdRef.current) {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('message_threads')
        .select('id')
        .eq('org_id', orgId)
        .eq('title', 'Général')
        .is('project_id', null)
        .maybeSingle() as unknown as { data: { id: string } | null }
      if (existing?.id) {
        generalThreadIdRef.current = existing.id
      } else {
        const { data: created, error: createErr } = await mutationClient()
          .from('message_threads')
          .insert({ org_id: orgId, title: 'Général', type: 'direct', created_by: currentUserId, project_id: null })
          .select('id')
          .single()
        if (createErr) {
          // Race condition: another client may have created it concurrently — retry select.
          const { data: retry } = await supabase
            .from('message_threads')
            .select('id')
            .eq('org_id', orgId)
            .eq('title', 'Général')
            .is('project_id', null)
            .maybeSingle() as unknown as { data: { id: string } | null }
          generalThreadIdRef.current = retry?.id ?? null
        } else {
          generalThreadIdRef.current = created?.id ?? null
        }
      }
    }

    if (!generalThreadIdRef.current) {
      showToast('Impossible de créer la conversation Général', 'error')
      setMsgContent(content)
      setSending(false)
      return
    }

    const { data, error } = await mutationClient()
      .from('messages')
      .insert({ org_id: orgId, sender_id: currentUserId, content, type, project_id: null, thread_id: generalThreadIdRef.current })
      .select('*')
      .single()

    setSending(false)
    if (error) { showToast(error.message, 'error'); setMsgContent(content); return }

    // Optimistic insert: add own message immediately.
    // Realtime will also fire and be deduped by id.
    if (data) {
      setLocalMessages(prev =>
        prev.some(m => m.id === data.id) ? prev : [data as MessageWithMeta, ...prev]
      )
    }
  }, [msgContent, sending, orgId, currentUserId, msgType, showToast])

  const handleFileSelect = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) { showToast('Image trop grande (max 10 Mo)', 'error'); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setPreviewFile(file)
  }, [showToast])

  const handlePhotoUpload = useCallback(async () => {
    if (!orgId || !photoProjectId || !previewFile) return
    setUploading(true)
    const ext = (previewFile.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `${orgId}/${photoProjectId}/${Date.now()}.${ext}`
    const mimeMap: Record<string, string> = {
      heic: 'image/heic', heif: 'image/heic',
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp',
    }
    const contentType = mimeMap[ext] ?? previewFile.type ?? 'image/jpeg'
    const supabase = createClient()
    const { error: uploadErr } = await supabase.storage
      .from('photos').upload(path, previewFile, { upsert: false, contentType })
    if (uploadErr) { showToast(uploadErr.message, 'error'); setUploading(false); return }
    const { data: signedData } = await supabase.storage.from('photos').createSignedUrl(path, 86400)
    const signedUrl = signedData?.signedUrl ?? ''
    const { error: dbErr } = await mutationClient().from('photos').insert({
      project_id: photoProjectId,
      org_id: orgId,
      url: signedUrl || path,
      storage_path: path,
      taken_by: currentUserId,
      task_id: photoLinkedTask?.id ?? null,
    })
    setUploading(false)
    if (dbErr) {
      void supabase.storage.from('photos').remove([path])
      showToast(dbErr.message, 'error')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    if (signedUrl) {
      const projectName = projects.find(p => p.id === photoProjectId)?.name ?? ''
      setLocalPhotos(prev => [{
        id: `local-${Date.now()}`,
        signedUrl,
        projectName,
        taskTitle: photoLinkedTask?.title,
      }, ...prev])
    }
    const successMsg = photoLinkedTask ? `Photo ajoutée à la tâche ✓` : 'Photo enregistrée ✓'
    setPhotoLinkedTask(null)
    showToast(successMsg)
    router.refresh()
  }, [orgId, photoProjectId, previewFile, previewUrl, photoLinkedTask, currentUserId, projects, router, showToast])

  const handleCancelPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
  }, [previewUrl])

  const handleReserveSubmit = useCallback(async () => {
    if (!reserveTitle.trim() || !reserveProjectId || !orgId) return
    setReserveLoading(true)
    const { error } = await mutationClient().from('issues').insert({
      project_id: reserveProjectId,
      org_id: orgId,
      title: reserveTitle.trim(),
      description: reserveDesc.trim() || null,
      priority: reservePriority,
      status: 'open',
      reported_by: currentUserId,
    })
    setReserveLoading(false)
    if (error) { showToast(error.message, 'error'); return }
    const linkedProject = projects.find(p => p.id === reserveProjectId)
    const optimisticIssue: IssueWithProject = {
      id: `temp-${Date.now()}`,
      title: reserveTitle.trim(),
      description: reserveDesc.trim() || null,
      priority: reservePriority,
      status: 'open',
      project_id: reserveProjectId,
      org_id: orgId,
      reported_by: currentUserId,
      assigned_to: null,
      task_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project: linkedProject ? { id: linkedProject.id, name: linkedProject.name } : null,
    }
    setLocalIssues(prev => [optimisticIssue, ...prev])
    setReserveTitle(''); setReserveDesc(''); setReservePriority('medium'); setShowReserveForm(false)
    showToast('Réserve signalée ✓')
    router.refresh()
  }, [reserveTitle, reserveProjectId, orgId, reserveDesc, reservePriority, currentUserId, projects, router, showToast])

  const handleLogout = useCallback(async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }, [router])

  const currentTabMeta = TAB_META.find(t => t.id === tab)!

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] bg-background">

      {/* ── Task detail sheet ── */}
      {selectedTask && (
        <MobileTaskDetailSheet task={selectedTask} onClose={handleCloseDetail} />
      )}

      {/* ── Toast ── */}
      {toastState && (
        <div className={cn(
          'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-600 shadow-xl transition-all max-w-xs text-center',
          toastState.err ? 'bg-destructive text-white' : 'bg-foreground text-background',
        )}>
          {toastState.text}
        </div>
      )}

      {/* ── Header ── */}
      <div className="shrink-0 bg-surface border-b border-border pt-safe">
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h1 className="text-base font-700 text-foreground leading-tight">{currentTabMeta.title}</h1>
            <p className="text-xs text-muted-foreground leading-tight">{accountDisplayName}</p>
          </div>
          <button
            onClick={() => setTab('profil')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-700 text-sm shrink-0 active:scale-95 transition-transform"
            style={{ background: avatarColor }}
            aria-label="Profil"
          >
            {initials}
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ─── AUJOURD'HUI ─── */}
        {tab === 'today' && (
          <div className="pb-8">
            {isUnlinkedField ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-yellow-500" />
                </div>
                <p className="font-700 text-foreground mb-2">Compte non rattaché</p>
                <p className="text-sm text-muted-foreground">Votre compte terrain n'est pas encore rattaché à un artisan. Contactez votre responsable pour qu'il vous rattache à votre fiche artisan.</p>
              </div>
            ) : tasks.length === 0 && recentlyDoneTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                  <CheckSquare className="h-8 w-8 text-green-500" />
                </div>
                <p className="font-700 text-foreground mb-1">Tout est à jour ✓</p>
                <p className="text-sm text-muted-foreground">Aucune tâche active pour le moment.</p>
              </div>
            ) : (
              <>
                {/* Summary chips */}
                <div className="flex gap-2 px-4 pt-4 pb-1 flex-wrap">
                  {urgentLate > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      <span className="text-xs font-700 text-destructive">{urgentLate} en retard</span>
                    </div>
                  )}
                  {inProgressTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-xl">
                      <Play className="h-2.5 w-2.5 fill-primary text-primary" />
                      <span className="text-xs font-700 text-primary">{inProgressTasks.length} en cours</span>
                    </div>
                  )}
                  {todayTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl">
                      <span className="text-xs font-700 text-muted-foreground">{todayTasks.length} aujourd'hui</span>
                    </div>
                  )}
                  {recentlyDoneTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-xl">
                      <Check className="h-2.5 w-2.5 text-green-500" />
                      <span className="text-xs font-700 text-green-500">{recentlyDoneTasks.length} terminée{recentlyDoneTasks.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                <TaskSection
                  title="En retard"
                  colorClass="text-destructive"
                  tasks={lateTasks}
                  doneIds={doneIds}
                  inProgressIds={inProgressIds}
                  taskLoading={taskLoading}
                  today={today}
                  onMarkDone={handleMarkDone}
                  onMarkInProgress={handleMarkInProgress}
                  onQuickSignal={handleQuickSignal}
                  onQuickPhoto={handleQuickPhoto}
                  onShowDetail={handleShowDetail}
                />
                <TaskSection
                  title="En cours"
                  colorClass="text-primary"
                  tasks={inProgressTasks}
                  doneIds={doneIds}
                  inProgressIds={inProgressIds}
                  taskLoading={taskLoading}
                  today={today}
                  onMarkDone={handleMarkDone}
                  onMarkInProgress={handleMarkInProgress}
                  onQuickSignal={handleQuickSignal}
                  onQuickPhoto={handleQuickPhoto}
                  onShowDetail={handleShowDetail}
                />
                <TaskSection
                  title="Aujourd'hui"
                  tasks={todayTasks}
                  doneIds={doneIds}
                  inProgressIds={inProgressIds}
                  taskLoading={taskLoading}
                  today={today}
                  onMarkDone={handleMarkDone}
                  onMarkInProgress={handleMarkInProgress}
                  onQuickSignal={handleQuickSignal}
                  onQuickPhoto={handleQuickPhoto}
                  onShowDetail={handleShowDetail}
                />
                <TaskSection
                  title="Cette semaine"
                  tasks={upcomingTasks}
                  doneIds={doneIds}
                  inProgressIds={inProgressIds}
                  taskLoading={taskLoading}
                  today={today}
                  onMarkDone={handleMarkDone}
                  onMarkInProgress={handleMarkInProgress}
                  onQuickSignal={handleQuickSignal}
                  onQuickPhoto={handleQuickPhoto}
                  onShowDetail={handleShowDetail}
                />
                <TaskSection
                  title="Sans date"
                  tasks={undatedTasks}
                  doneIds={doneIds}
                  inProgressIds={inProgressIds}
                  taskLoading={taskLoading}
                  today={today}
                  onMarkDone={handleMarkDone}
                  onMarkInProgress={handleMarkInProgress}
                  onQuickSignal={handleQuickSignal}
                  onQuickPhoto={handleQuickPhoto}
                  onShowDetail={handleShowDetail}
                />
                <DoneSection tasks={recentlyDoneTasks} today={today} onShowDetail={handleShowDetail} />
              </>
            )}
          </div>
        )}

        {/* ─── CHANTIERS ─── */}
        {tab === 'chantiers' && (
          <div className="p-4 flex flex-col gap-3 pb-8">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-700 text-foreground mb-1">Aucun chantier actif</p>
                <p className="text-sm text-muted-foreground">Les chantiers actifs apparaîtront ici.</p>
              </div>
            ) : projects.map(project => {
              const taskCount  = tasksByProject[project.id]  ?? 0
              const issueCount = issuesByProject[project.id] ?? 0
              const pAny = project as (typeof project & { address?: string })
              return (
                <a
                  key={project.id}
                  href={`/chantiers/${project.id}`}
                  className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: project.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-700 text-foreground text-sm leading-snug">{project.name}</p>
                      {pAny.address && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{pAny.address}</p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${project.progress ?? 0}%`, background: project.color }}
                      />
                    </div>
                    <span className="text-xs font-700 text-foreground w-9 text-right shrink-0">
                      {project.progress ?? 0}%
                    </span>
                  </div>

                  {(taskCount > 0 || issueCount > 0) && (
                    <div className="flex gap-2">
                      {taskCount > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 rounded-lg">
                          <CheckSquare className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-700 text-primary">
                            {taskCount} tâche{taskCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {issueCount > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-destructive/10 rounded-lg">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="text-[10px] font-700 text-destructive">
                            {issueCount} réserve{issueCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </a>
              )
            })}
          </div>
        )}

        {/* ─── MESSAGES (feed only) ─── */}
        {tab === 'messages' && (
          <div className="px-4 pt-4 pb-4 flex flex-col gap-2 min-h-full">

            {localMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-700 text-foreground mb-1">Aucun message</p>
                <p className="text-sm text-muted-foreground">Soyez le premier à écrire.</p>
              </div>
            )}
            {[...localMessages].reverse().map(msg => {
              const isMine   = msg.sender_id === currentUserId
              const isSpecial = msg.type && msg.type !== 'text'
              const typeMeta = MSG_TYPES.find(q => q.type === msg.type)
              return (
                <div key={msg.id} className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
                  {!isMine && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-700 text-muted-foreground shrink-0 self-end mb-4">
                      {msg.sender?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className={cn('max-w-[78%] flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
                    {!isMine && (
                      <span className="text-[10px] text-muted-foreground px-1 font-600">{msg.sender?.full_name}</span>
                    )}
                    {isSpecial ? (
                      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/40">
                          <span>{typeMeta?.emoji ?? '📌'}</span>
                          <span className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">
                            {typeMeta?.label ?? msg.type}
                          </span>
                        </div>
                        <p className="text-sm px-3 py-2.5 text-foreground">{msg.content}</p>
                      </div>
                    ) : (
                      <div className={cn(
                        'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                        isMine
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-surface border border-border text-foreground rounded-bl-sm',
                      )}>
                        {msg.content}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground px-1">{formatRelative(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ─── PHOTOS & RÉSERVES ─── */}
        {tab === 'photos' && (
          <div className="p-4 flex flex-col gap-6 pb-8">

            {/* Section Photos */}
            <section ref={photoFormRef}>
              <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Ajouter une photo</p>
              <div className={cn(
                'bg-surface border rounded-2xl overflow-hidden transition-all',
                photoLinkedTask ? 'border-primary/50' : 'border-border',
              )}>
                {projects.length === 0 ? (
                  <div className="p-6 text-center">
                    <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">Aucun chantier actif — upload impossible.</p>
                  </div>
                ) : (
                  <div className="p-4 flex flex-col gap-3">
                    {/* Tâche liée — chip visible si arrivé via Quick Photo */}
                    {photoLinkedTask && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-xl">
                        <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-600 text-primary flex-1 truncate">
                          Tâche : {photoLinkedTask.title}
                        </span>
                        <button
                          onClick={handleClearPhotoTask}
                          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-primary/20 text-primary"
                          aria-label="Retirer la tâche liée"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <select
                      value={photoProjectId}
                      // LOT 39 — changer de chantier détache la tâche liée (elle
                      // appartient à un autre chantier) pour éviter tout rattachement croisé.
                      onChange={e => { setPhotoProjectId(e.target.value); setPhotoLinkedTask(null) }}
                      className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    {previewUrl ? (
                      <div className="flex flex-col gap-3">
                        <div className="relative rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '4/3' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt="Aperçu"
                            className="w-full h-full object-cover"
                            onError={e => {
                              const el = e.target as HTMLImageElement
                              el.style.display = 'none'
                              el.parentElement!.insertAdjacentHTML('beforeend', '<div class="flex items-center justify-center h-full text-muted-foreground text-sm">Aperçu non disponible (HEIC)</div>')
                            }}
                          />
                          <button
                            onClick={handleCancelPreview}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90"
                            aria-label="Annuler"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={handlePhotoUpload}
                          disabled={uploading}
                          className="h-12 bg-primary text-white rounded-xl font-700 text-sm active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {uploading
                            ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Envoi en cours…</>
                            : photoLinkedTask ? 'Envoyer et lier à la tâche' : 'Envoyer la photo'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'flex flex-col items-center justify-center gap-2 w-full py-10 border-2 border-dashed rounded-xl active:scale-[0.98] transition-all',
                            photoLinkedTask
                              ? 'border-primary/60 text-primary hover:bg-primary/5'
                              : 'border-primary/40 text-primary hover:bg-primary/5',
                          )}
                        >
                          <Camera className="h-8 w-8 opacity-70" />
                          <span className="font-700 text-sm">
                            {photoLinkedTask ? 'Prendre une photo pour la tâche' : 'Prendre / sélectionner une photo'}
                          </span>
                          <span className="text-xs opacity-60">JPEG · PNG · WEBP · HEIC — max 10 Mo</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Photos récentes — uploadées cette session */}
            {localPhotos.length > 0 && (
              <section>
                <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">
                  Photos uploadées ({localPhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {localPhotos.map(photo => (
                    <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-muted relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.signedUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                        {photo.taskTitle ? `📌 ${photo.taskTitle}` : photo.projectName}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Section Réserves */}
            <section>
              <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-3">Signaler une réserve</p>
              {!showReserveForm ? (
                <button
                  onClick={() => { setShowReserveForm(true); setReserveProjectId(projects[0]?.id ?? ''); setReserveTitle(''); setReserveDesc('') }}
                  className="flex items-center gap-3 w-full p-4 border-2 border-dashed border-destructive/40 rounded-2xl text-destructive active:scale-[0.98] transition-all hover:bg-destructive/5"
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-700 text-sm">Signaler une réserve</span>
                </button>
              ) : (
                <div className="bg-surface border border-destructive/30 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-700 text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Nouvelle réserve
                    </p>
                    <button
                      onClick={() => setShowReserveForm(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {projects.length > 0 && (
                    <select
                      value={reserveProjectId}
                      onChange={e => setReserveProjectId(e.target.value)}
                      className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}

                  <input
                    placeholder="Titre de la réserve *"
                    value={reserveTitle}
                    onChange={e => setReserveTitle(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  <textarea
                    placeholder="Description (optionnel)"
                    value={reserveDesc}
                    onChange={e => setReserveDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Priority selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setReservePriority(p)}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-700 border transition-all active:scale-95',
                          reservePriority === p
                            ? (p === 'critical' || p === 'high')
                              ? 'bg-destructive text-white border-destructive'
                              : p === 'medium'
                                ? 'bg-primary text-white border-primary'
                                : 'bg-muted text-foreground border-border'
                            : 'border-border text-muted-foreground bg-background',
                        )}
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleReserveSubmit}
                    disabled={!reserveTitle.trim() || !reserveProjectId || reserveLoading || !orgId}
                    className="h-12 bg-destructive text-white rounded-xl font-700 text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {reserveLoading ? 'Envoi…' : 'Signaler la réserve'}
                  </button>
                </div>
              )}

              {/* Réserves en cours */}
              {localIssues.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Mes réserves en cours</p>
                  {localIssues.map(issue => (
                    <div
                      key={issue.id}
                      className={cn(
                        'bg-surface border rounded-2xl p-3.5 flex flex-col gap-1.5',
                        issue.priority === 'critical' || issue.priority === 'high'
                          ? 'border-destructive/30' : 'border-border',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={cn(
                          'h-3.5 w-3.5 mt-0.5 shrink-0',
                          issue.priority === 'critical' || issue.priority === 'high'
                            ? 'text-destructive' : 'text-yellow-500',
                        )} />
                        <p className="text-sm font-600 text-foreground flex-1">{issue.title}</p>
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-600 shrink-0">
                          {ISSUE_STATUS_LABELS[issue.status] ?? issue.status}
                        </span>
                      </div>
                      {issue.project && (
                        <p className="text-xs text-muted-foreground pl-5">{issue.project.name}</p>
                      )}
                      <div className="pl-5">
                        <span className={cn(
                          'text-[10px] font-600 px-2 py-0.5 rounded-full',
                          issue.priority === 'critical' ? 'bg-destructive/10 text-destructive'
                          : issue.priority === 'high'   ? 'bg-orange-500/10 text-orange-500'
                          :                              'bg-muted text-muted-foreground',
                        )}>
                          {PRIORITY_LABELS[issue.priority] ?? issue.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ─── PROFIL ─── */}
        {tab === 'profil' && (
          <div className="p-4 pb-8 flex flex-col gap-4">
            {/* Identity card — account, not artisan */}
            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-700 text-xl shrink-0"
                style={{ background: avatarColor }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-700 text-foreground text-base truncate">{accountDisplayName}</p>
                {profile?.full_name && (
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                )}
                {profile?.role && (
                  <span className="inline-block mt-1.5 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-700">
                    {ROLE_LABEL[profile.role] ?? profile.role}
                  </span>
                )}
              </div>
            </div>

            {/* Artisan affiliation — separate from account identity */}
            {artisan ? (
              <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Rattachement terrain</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-700 shrink-0"
                    style={{ background: artisan.color ?? '#2563EB' }}
                  >
                    {(artisan.full_name ?? 'A').trim().split(/\s+/).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) || 'A'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-600 text-foreground truncate">{artisan.full_name}</p>
                    {artisan.trade && <p className="text-xs text-muted-foreground truncate">{artisan.trade}</p>}
                  </div>
                </div>
              </div>
            ) : profile?.role === 'artisan' && (
              <div className="bg-surface border border-border rounded-2xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Compte non rattaché à une fiche artisan.</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface border border-border rounded-2xl p-3 text-center">
                <p className="text-xl font-700 text-foreground">{tasks.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Tâches<br/>actives</p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 text-center">
                <p className="text-xl font-700 text-green-500">{recentlyDoneTasks.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Terminées<br/>aujourd'hui</p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 text-center">
                <p className={cn('text-xl font-700', localIssues.length > 0 ? 'text-destructive' : 'text-foreground')}>
                  {localIssues.length}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Réserves<br/>ouvertes</p>
              </div>
            </div>

            {/* Artisan contact details */}
            {(artisan?.phone || artisan?.email) && (
              <div className="bg-surface border border-border rounded-2xl divide-y divide-border">
                {artisan.phone && (
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Téléphone</span>
                    <a href={`tel:${artisan.phone}`} className="text-sm font-600 text-primary">{artisan.phone}</a>
                  </div>
                )}
                {artisan.email && (
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email professionnel</span>
                    <span className="text-sm font-600 text-foreground truncate max-w-[55%] text-right">{artisan.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Apparence */}
            <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Apparence</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'light'  as Theme, label: 'Clair',   Icon: Sun     },
                  { value: 'dark'   as Theme, label: 'Sombre',  Icon: Moon    },
                  { value: 'system' as Theme, label: 'Système', Icon: Monitor },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-600 transition-all active:scale-95',
                      theme === value
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-muted-foreground bg-background hover:border-primary/40',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <a
                href="/settings"
                className="flex items-center justify-between bg-surface border border-border rounded-2xl px-4 py-4 transition-colors hover:border-primary/30 active:scale-[0.99]"
              >
                <span className="text-sm font-600 text-foreground">Paramètres du profil</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              <a
                href="/"
                className="flex items-center justify-between bg-surface border border-border rounded-2xl px-4 py-4 transition-colors hover:border-primary/30 active:scale-[0.99]"
              >
                <span className="text-sm font-600 text-foreground">Version bureau</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-4 bg-destructive/5 border border-destructive/20 rounded-2xl text-destructive active:scale-[0.99] transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-600">Se déconnecter</span>
              </button>
            </div>
          </div>
        )}

      </div>{/* end scrollable content */}

      {/* ── Messages compose bar (outside scroll, above bottom nav) ── */}
      {tab === 'messages' && (
        <div className="shrink-0 border-t border-border bg-surface">
          {/* Type chips */}
          <div className="flex gap-1.5 px-4 pt-2.5 pb-2 overflow-x-auto scrollbar-none">
            {MSG_TYPES.map(q => (
              <button
                key={q.type}
                onClick={() => setMsgType(prev => prev === q.type ? 'text' : q.type)}
                className={cn(
                  'shrink-0 flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-full border font-600 transition-all whitespace-nowrap',
                  msgType === q.type
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground bg-background',
                )}
              >
                {q.emoji} {q.label}
              </button>
            ))}
          </div>
          {/* Input row */}
          <div className="flex items-end gap-2 px-4 pb-3">
            <div className="flex-1 min-h-[44px] bg-background border border-border rounded-2xl px-4 py-3 focus-within:border-primary transition-colors">
              <textarea
                value={msgContent}
                onChange={e => setMsgContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                placeholder={
                  msgType !== 'text'
                    ? `${MSG_TYPES.find(q => q.type === msgType)?.label}…`
                    : 'Message…'
                }
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
                rows={1}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!msgContent.trim() || sending || !orgId}
              className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40"
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom navigation ── */}
      <div className="shrink-0 bg-surface border-t border-border pb-safe">
        <div className="flex">
          {TAB_META.map(t => {
            const badge = t.id === 'today' ? urgentLate : 0
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <div className="relative">
                  <t.icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-destructive text-white text-[9px] flex items-center justify-center font-700">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className={cn('text-[10px] font-600 leading-none', active ? 'text-primary' : 'text-muted-foreground')}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
