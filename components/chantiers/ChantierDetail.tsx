'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Settings, Archive, X, CheckCircle2, RotateCcw,
  Clock, AlertTriangle, AlertOctagon, Calendar, FileText,
  Image as ImageIcon, Flag, MapPin, Pencil, Trash2, ArrowRight,
  Users, Package, MessageSquare, BarChart3, CheckSquare, ExternalLink,
  Send, Camera, CheckCheck, ImageOff,
} from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { useToast } from '@/components/ui/toast-context'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { TaskPanel } from '@/components/tasks/TaskPanel'
import { NouvelleTacheModal } from '@/components/chantiers/NouvelleTacheModal'
import { EditTacheModal } from '@/components/chantiers/EditTacheModal'
import { EditChantierModal } from '@/components/chantiers/EditChantierModal'
import { NouvelleReserveModal } from '@/components/chantiers/NouvelleReserveModal'
import { EditReserveModal } from '@/components/chantiers/EditReserveModal'
import { WeekByDay, type WeekDayTask } from '@/components/dashboard/WeekByDay'
import {
  cn, formatDate, formatRelative, getInitials, isLate,
  projectStatusLabel, projectStatusColor,
} from '@/lib/utils'
import type { Project, Task, Issue, Photo, Document, Message, Material, Delivery, Report, ActivityLog } from '@/lib/types'
import { resolveDemoImageSrc } from '@/lib/demo-images'

interface Artisan { id: string; full_name: string | null; trade: string | null; color: string | null }
interface TeamOption { id: string; name: string; color: string | null; type: string | null; memberCount: number }

type Tab = 'overview' | 'planning' | 'equipes' | 'photos' | 'messagerie' | 'reserves'

interface Props {
  project: Project
  tasks: (Task & { assignee?: any; team?: any })[]
  issues: (Issue & { artisan?: any })[]
  photos: (Photo & { taken_by_profile?: any })[]
  documents: Document[]
  messages: (Message & { sender?: any })[]
  materials: Material[]
  deliveries: Delivery[]
  reports: Report[]
  logs: (ActivityLog & { profile?: any })[]
  artisans: Artisan[]
  teams?: TeamOption[]
  projectTeams?: TeamOption[]
  currentUserId: string
  focus?: 'task' | 'issue'
  focusId?: string
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

const MSG_TYPE_META: Record<string, { label: string; pill: string }> = {
  probleme:            { label: 'Problème',   pill: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  validation_demandee: { label: 'Validation', pill: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  consigne:            { label: 'Consigne',   pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  question:            { label: 'Question',   pill: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  tache_terminee:      { label: 'Terminé',    pill: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  text:                { label: 'Info',       pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
}

function issuePriorityLabel(p: string | null | undefined): string {
  if (p === 'critical') return 'Critique'
  if (p === 'high')     return 'Haute'
  if (p === 'medium')   return 'Moyenne'
  return 'Basse'
}

export function ChantierDetail({
  project, tasks, issues, photos, documents, messages, materials, deliveries, reports, logs,
  artisans, teams = [], projectTeams = [], currentUserId,
  focus, focusId,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const today = new Date().toISOString().split('T')[0]

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showEditChantier, setShowEditChantier] = useState(false)
  const [editingTask, setEditingTask] = useState<typeof tasks[0] | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [showNewIssue, setShowNewIssue] = useState(false)
  const [editingIssue, setEditingIssue] = useState<(Issue & { artisan?: any }) | null>(null)
  const [resolveLoadingId, setResolveLoadingId] = useState<string | null>(null)
  const [highlightIssueId, setHighlightIssueId] = useState<string | null>(null)
  // Deep-link
  useEffect(() => {
    if (!focus || !focusId) return
    if (focus === 'task') {
      const t = tasks.find(t => t.id === focusId)
      if (t) setSelectedTask(t as Task)
    } else if (focus === 'issue') {
      const i = issues.find(i => i.id === focusId)
      if (i) {
        setActiveTab('reserves')
        setEditingIssue(i)
        setHighlightIssueId(i.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mutations ────────────────────────────────────────────────────────────────
  const handleResolveIssue = async (issue: Issue & { artisan?: any }) => {
    const newStatus = (issue.status === 'fixed' || issue.status === 'validated') ? 'open' as const : 'fixed' as const
    setResolveLoadingId(issue.id)
    const { error: err } = await mutationClient().from('issues').update({ status: newStatus })
      .eq('id', issue.id).eq('project_id', project.id).eq('org_id', project.org_id)
    setResolveLoadingId(null)
    if (err) { toast(err.message, 'error'); return }
    toast(newStatus === 'fixed' ? 'Réserve résolue' : 'Réserve rouverte')
    router.refresh()
  }

  const handleArchive = async () => {
    setArchiveLoading(true)
    const { error: err } = await mutationClient().from('projects').update({ status: 'archived' })
      .eq('id', project.id).eq('org_id', project.org_id)
    setArchiveLoading(false)
    if (err) { toast(err.message, 'error'); return }
    toast('Chantier archivé')
    router.push('/chantiers')
  }

  const handleDelete = async (taskId: string) => {
    setDeleteLoading(true)
    const { error: err } = await mutationClient().from('tasks').delete()
      .eq('id', taskId).eq('project_id', project.id)
    setDeleteLoading(false)
    setConfirmDeleteId(null)
    if (err) { toast(err.message, 'error'); return }
    if (selectedTask?.id === taskId) setSelectedTask(null)
    toast('Tâche supprimée')
    router.refresh()
  }

  // ── Computed KPIs ────────────────────────────────────────────────────────────
  const tasksDone   = tasks.filter(t => t.status === 'done' || t.status === 'validated').length
  const suggestedProgress = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : undefined
  const kpiOpen     = tasks.filter(t => t.status !== 'done' && t.status !== 'validated').length
  const kpiLate     = tasks.filter(t => isLate(t.end_date, t.status)).length
  const kpiIssues   = issues.filter(i => i.status !== 'fixed' && i.status !== 'validated' && i.status !== 'rejected').length
  const nextTask    = tasks
    .filter(t => t.end_date && t.status !== 'done' && t.status !== 'validated' && t.end_date >= today)
    .sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''))
    .at(0)
  const nextDeadlineValue = nextTask?.end_date ? formatDate(nextTask.end_date) : '—'
  const daysLeft  = project.end_date ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000) : null
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft < 7
  const openIssues = issues.filter(i => i.status !== 'fixed' && i.status !== 'validated' && i.status !== 'rejected')

  // À traiter urgents
  const urgentItems: {
    key: string; type: 'blocked' | 'late' | 'issue'
    title: string; assignee: { full_name: string | null; color: string | null } | null
    date: string | null; task: (Task & { assignee?: any }) | null
  }[] = [
    ...tasks.filter(t => t.status === 'blocked').slice(0, 2).map(t => ({
      key: `b-${t.id}`, type: 'blocked' as const, title: t.title,
      assignee: t.assignee ?? null, date: t.end_date ?? null, task: t,
    })),
    ...tasks.filter(t => isLate(t.end_date, t.status) && t.status !== 'blocked').slice(0, 2).map(t => ({
      key: `l-${t.id}`, type: 'late' as const, title: t.title,
      assignee: t.assignee ?? null, date: t.end_date ?? null, task: t,
    })),
    ...issues.filter(i => (i.priority === 'critical' || i.priority === 'high') && i.status === 'open').slice(0, 2).map(i => ({
      key: `i-${i.id}`, type: 'issue' as const, title: i.title,
      assignee: i.artisan ?? null, date: null, task: null,
    })),
  ].slice(0, 5)

  // Équipes actives (artisans with tasks on this project)
  const teamMap = new Map<string, { id: string; name: string; color: string; trade: string | null; taskCount: number }>()
  tasks.forEach(t => {
    if (t.assignee?.id) {
      const a = t.assignee
      const ex = teamMap.get(a.id)
      if (ex) { ex.taskCount++ }
      else teamMap.set(a.id, { id: a.id, name: a.full_name ?? '?', color: a.color ?? '#6B7280', trade: a.trade ?? null, taskCount: 1 })
    }
  })
  const team = Array.from(teamMap.values())

  // WeekByDay tasks mapping
  const weekTasks: WeekDayTask[] = tasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    start_date: t.start_date,
    end_date: t.end_date,
    project_id: project.id,
    project: { name: project.name, color: project.color },
    assignee: t.assignee ? { full_name: t.assignee.full_name } : null,
    team: t.team ? { name: t.team.name } : null,
  }))

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview',    label: 'Vue d\'ensemble' },
    { id: 'planning',    label: 'Planning' },
    { id: 'equipes',     label: 'Équipes', badge: team.length + projectTeams.length || undefined },
    { id: 'photos',      label: 'Photos & docs', badge: photos.length || undefined },
    { id: 'messagerie',  label: 'Messagerie', badge: messages.length || undefined },
    { id: 'reserves',    label: 'Réserves', badge: kpiIssues || undefined },
  ]

  return (
    <div className={cn('flex h-full overflow-hidden', selectedTask && '')}>
      <div className={cn('flex flex-col flex-1 overflow-hidden transition-all duration-200', selectedTask && 'mr-[460px]')}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0">
          {/* Color accent strip */}
          <div className="h-[5px] w-full" style={{ background: project.color }} />

          <div className="px-5 lg:px-8 py-4 bg-surface border-b border-border/40 dark:border-white/[0.06]">
            {/* Row 1: breadcrumb + actions */}
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <Link
                href="/chantiers"
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors font-600 shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Chantiers
              </Link>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowNewTask(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[12px] font-600 rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Plus className="h-3 w-3" />
                  Tâche
                </button>
                <button
                  onClick={() => setShowNewIssue(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border/50 text-[12px] font-600 rounded-xl hover:bg-elevated transition-colors"
                >
                  <Flag className="h-3 w-3 text-orange-500" />
                  Réserve
                </button>
                <button
                  onClick={() => setShowEditChantier(true)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-elevated rounded-xl transition-colors"
                  title="Modifier"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                {project.status !== 'archived' && (
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-colors"
                    title="Archiver"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: name + status + deadline */}
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <h1 className="text-[1.5rem] font-extrabold text-foreground tracking-tight leading-none">
                {project.name}
              </h1>
              <span className={cn('text-[10.5px] font-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0', projectStatusColor(project.status))}>
                {projectStatusLabel(project.status)}
              </span>
              {daysLeft !== null && (
                <span className={cn('text-[10.5px] font-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0', {
                  'bg-red-500/10 text-red-600 dark:text-red-400':          isOverdue,
                  'bg-orange-500/10 text-orange-600 dark:text-orange-400': isUrgent && !isOverdue,
                  'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400': !isOverdue && !isUrgent,
                })}>
                  {isOverdue
                    ? `Dépassé de ${Math.abs(daysLeft)}j`
                    : daysLeft === 0 ? "Échéance aujourd'hui"
                    : `J−${daysLeft}`}
                </span>
              )}
              {kpiLate > 0 && (
                <span className="text-[10.5px] font-700 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">
                  {kpiLate} en retard
                </span>
              )}
            </div>

            {/* Row 3: address + dates + progress */}
            <div className="flex items-center gap-4 flex-wrap">
              {project.address && (
                <span className="text-[11.5px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />{project.address}
                </span>
              )}
              {project.start_date && (
                <span className="text-[11.5px] text-muted-foreground">
                  <span className="opacity-50 mr-1">Début</span>
                  <span className="font-600 text-foreground">{formatDate(project.start_date)}</span>
                </span>
              )}
              {project.end_date && (
                <span className={cn('text-[11.5px]', isOverdue ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-muted-foreground')}>
                  <span className="opacity-50 mr-1">Fin prévue</span>
                  <span className="font-600">{formatDate(project.end_date)}</span>
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto min-w-[140px]">
                <span className="text-[12px] font-extrabold text-foreground tabular-nums shrink-0">{project.progress}%</span>
                <Progress value={project.progress} className="flex-1 h-1.5" />
              </div>
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────────── */}
          <div className="px-5 lg:px-8 bg-surface border-b border-border/25 overflow-x-auto">
            <div className="flex gap-1 min-w-max py-1.5">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-600 transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-elevated',
                  )}
                >
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={cn(
                      'min-w-[17px] h-[17px] rounded-full text-[9px] font-700 flex items-center justify-center px-1 leading-none',
                      activeTab === tab.id
                        ? 'bg-blue-200/70 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                    )}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-background/50 dark:bg-background/80">
          {activeTab === 'overview' && (
            <OverviewTab
              project={project}
              kpiOpen={kpiOpen}
              kpiLate={kpiLate}
              kpiIssues={kpiIssues}
              nextDeadlineValue={nextDeadlineValue}
              urgentItems={urgentItems}
              logs={logs}
              tasks={tasks}
              today={today}
              onTaskClick={setSelectedTask}
              onEdit={setEditingTask}
              onDelete={setConfirmDeleteId}
              confirmDeleteId={confirmDeleteId}
              deleteLoading={deleteLoading}
              onConfirmDelete={handleDelete}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onGoToTab={setActiveTab}
            />
          )}
          {activeTab === 'planning' && (
            <div className="p-5 lg:p-8">
              <WeekByDay tasks={weekTasks} today={today} />
            </div>
          )}
          {activeTab === 'equipes' && (
            <EquipesTab
              projectTeams={projectTeams}
              team={team}
              tasks={tasks}
              artisans={artisans}
            />
          )}
          {activeTab === 'photos' && (
            <PhotosTab photos={photos} documents={documents} />
          )}
          {activeTab === 'messagerie' && (
            <MessagerieTab
              initialMessages={messages}
              currentUserId={currentUserId}
              projectId={project.id}
              orgId={project.org_id}
            />
          )}
          {activeTab === 'reserves' && (
            <ReservesTab
              issues={issues}
              highlightIssueId={highlightIssueId}
              resolveLoadingId={resolveLoadingId}
              onEdit={setEditingIssue}
              onResolve={handleResolveIssue}
              onAdd={() => setShowNewIssue(true)}
            />
          )}
        </div>
      </div>

      {/* Task side panel */}
      {selectedTask && <TaskPanel task={selectedTask} onClose={() => setSelectedTask(null)} />}

      {/* Modals */}
      {showNewTask && (
        <NouvelleTacheModal projectId={project.id} orgId={project.org_id} artisans={artisans} teams={teams} onClose={() => setShowNewTask(false)} />
      )}
      {editingTask && (
        <EditTacheModal task={editingTask} projectId={project.id} artisans={artisans} onClose={() => setEditingTask(null)} />
      )}
      {showEditChantier && (
        <EditChantierModal project={project} suggestedProgress={suggestedProgress} onClose={() => setShowEditChantier(false)} />
      )}
      {showNewIssue && (
        <NouvelleReserveModal projectId={project.id} orgId={project.org_id} artisans={artisans} onClose={() => setShowNewIssue(false)} />
      )}
      {editingIssue && (
        <EditReserveModal issue={editingIssue} projectId={project.id} orgId={project.org_id} artisans={artisans} onClose={() => setEditingIssue(null)} />
      )}

      {/* Archive confirm */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-orange-500" />
                <h2 className="font-700 text-foreground">Archiver ce chantier ?</h2>
              </div>
              <button onClick={() => setShowArchiveConfirm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Il ne sera plus affiché parmi les chantiers actifs, mais ses données seront conservées.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleArchive} disabled={archiveLoading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-0">
                  {archiveLoading ? 'Archivage…' : 'Archiver le chantier'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowArchiveConfirm(false)} disabled={archiveLoading}>
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  project, kpiOpen, kpiLate, kpiIssues, nextDeadlineValue,
  urgentItems, logs, tasks, today,
  onTaskClick, onEdit, onDelete, confirmDeleteId, deleteLoading,
  onConfirmDelete, onCancelDelete, onGoToTab,
}: {
  project: Project
  kpiOpen: number; kpiLate: number; kpiIssues: number; nextDeadlineValue: string
  urgentItems: any[]
  logs: (ActivityLog & { profile?: any })[]
  tasks: (Task & { assignee?: any; team?: any })[]
  today: string
  onTaskClick: (t: Task & { assignee?: any; team?: any }) => void
  onEdit: (t: Task & { assignee?: any; team?: any }) => void
  onDelete: (id: string) => void
  confirmDeleteId: string | null
  deleteLoading: boolean
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  onGoToTab: (tab: Tab) => void
}) {
  const upcomingTasks = tasks
    .filter(t => t.status !== 'done' && t.status !== 'validated')
    .sort((a, b) => !a.end_date ? 1 : !b.end_date ? -1 : a.end_date.localeCompare(b.end_date))
    .slice(0, 6)

  return (
    <div className="p-5 lg:p-8 flex flex-col gap-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Tâches ouvertes" value={kpiOpen} icon={CheckSquare} color="blue" />
        <KpiTile label="En retard"        value={kpiLate}     icon={Clock}       color={kpiLate > 0 ? 'red' : 'blue'}    alert={kpiLate > 0} />
        <KpiTile label="Réserves ouvertes" value={kpiIssues}  icon={Flag}        color={kpiIssues > 0 ? 'orange' : 'blue'} alert={kpiIssues > 0} />
        <KpiTile label="Prochaine échéance" value={nextDeadlineValue} icon={Calendar} color="blue" small />
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* À traiter — 2/3 */}
        <div className="xl:col-span-2">
          <DashTile
            title="À traiter maintenant"
            badge={urgentItems.length > 0 ? urgentItems.length : undefined}
            badgeColor="red"
            urgent={urgentItems.length > 0}
          >
            {urgentItems.length === 0 ? (
              <div className="flex items-center gap-4 px-6 py-5">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-600 text-foreground">Tout est sous contrôle</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Aucune action urgente sur ce chantier.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/15 dark:divide-white/[0.04]">
                {urgentItems.map(item => (
                  <div
                    key={item.key}
                    onClick={() => item.task ? onTaskClick(item.task) : undefined}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3.5',
                      'hover:bg-elevated/35 transition-colors group/item',
                      item.task ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <div className={cn('w-[3px] h-8 rounded-full shrink-0', {
                      'bg-red-500': item.type === 'blocked',
                      'bg-amber-500': item.type === 'late',
                      'bg-orange-500': item.type === 'issue',
                    })} />
                    <div className={cn('shrink-0', {
                      'text-red-500': item.type === 'blocked',
                      'text-amber-500': item.type === 'late',
                      'text-orange-500': item.type === 'issue',
                    })}>
                      {item.type === 'blocked' && <AlertOctagon className="h-4 w-4" />}
                      {item.type === 'late'    && <Clock         className="h-4 w-4" />}
                      {item.type === 'issue'   && <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-600 text-foreground truncate">{item.title}</p>
                    </div>
                    {item.assignee && (
                      <div
                        className="w-6 h-6 rounded-full text-[10px] font-700 text-white flex items-center justify-center shrink-0"
                        style={{ background: item.assignee.color ?? '#6B7280' }}
                      >
                        {(item.assignee.full_name ?? '?')[0]}
                      </div>
                    )}
                    {item.date && (
                      <span className="text-[11px] text-red-500 font-500 shrink-0">{formatDate(item.date)}</span>
                    )}
                    <span className={cn('text-[10px] font-700 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap', {
                      'bg-red-500/10 text-red-600 dark:text-red-400':          item.type === 'blocked',
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400':    item.type === 'late',
                      'bg-orange-500/10 text-orange-600 dark:text-orange-400': item.type === 'issue',
                    })}>
                      {item.type === 'blocked' ? 'Bloquée' : item.type === 'late' ? 'Retard' : 'Réserve'}
                    </span>
                    {item.task && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/item:opacity-60 transition-opacity shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </DashTile>
        </div>

        {/* Activité — 1/3 */}
        <div className="xl:col-span-1">
          <DashTile title="Activité récente">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-[12px] text-muted-foreground">Aucune activité</p>
              </div>
            ) : (
              <div className="px-2 py-2">
                {logs.slice(0, 8).map(log => {
                  const name = log.profile?.full_name ?? 'Système'
                  const meta = log.metadata as Record<string, string> | null
                  const actionLabel: Record<string, string> = {
                    created: 'a créé', updated: 'a modifié', deleted: 'a supprimé',
                    status_changed: 'a changé le statut de', assigned: 'a assigné',
                    commented: 'a commenté', uploaded: 'a uploadé',
                  }
                  const entityLabel: Record<string, string> = {
                    task: 'la tâche', project: 'le chantier', issue: 'la réserve',
                    document: 'le document', photo: 'une photo',
                  }
                  return (
                    <div key={log.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-elevated/40 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[9px] font-700 flex items-center justify-center shrink-0 mt-0.5">
                        {getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] text-foreground leading-snug">
                          <span className="font-600">{name}</span>
                          {' '}<span className="text-muted-foreground">{actionLabel[log.action] ?? log.action}</span>
                          {' '}<span className="text-muted-foreground">{entityLabel[log.entity_type] ?? log.entity_type}</span>
                          {meta?.name && <span className="font-500 text-foreground"> «{meta.name}»</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatRelative(log.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DashTile>
        </div>
      </div>

      {/* Tâches à venir */}
      <DashTile
        title="Prochaines tâches"
        badge={upcomingTasks.length || undefined}
        action={
          <button
            onClick={() => onGoToTab('planning')}
            className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-1 transition-colors"
          >
            Voir le planning <ArrowRight className="h-2.5 w-2.5" />
          </button>
        }
      >
        {upcomingTasks.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            <p className="text-[12px] text-muted-foreground">Toutes les tâches sont terminées</p>
          </div>
        ) : (
          <div className="divide-y divide-border/15 dark:divide-white/[0.04]">
            {upcomingTasks.map(task => {
              const late = isLate(task.end_date, task.status)
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-elevated/35 transition-colors cursor-pointer group/row"
                  onClick={() => onTaskClick(task)}
                >
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    task.status === 'in_progress' ? 'bg-blue-500' :
                    task.status === 'blocked'     ? 'bg-red-500' :
                    late                          ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600',
                  )} />
                  <p className="flex-1 text-[12.5px] font-500 text-foreground truncate">{task.title}</p>
                  {task.assignee && (
                    <div className="w-5 h-5 rounded-full text-[9px] font-700 text-white flex items-center justify-center shrink-0" style={{ background: task.assignee.color }}>
                      {(task.assignee.full_name ?? '?')[0]}
                    </div>
                  )}
                  {task.end_date && (
                    <span className={cn('text-[11px] font-500 shrink-0', late ? 'text-red-500' : 'text-muted-foreground/60')}>
                      {formatDate(task.end_date)}
                    </span>
                  )}
                  <StatusPill status={task.status} />
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/row:opacity-60 transition-opacity shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </DashTile>
    </div>
  )
}

// ── Équipes Tab ───────────────────────────────────────────────────────────────

function EquipesTab({ projectTeams, team, tasks, artisans }: {
  projectTeams: TeamOption[]
  team: { id: string; name: string; color: string; trade: string | null; taskCount: number }[]
  tasks: (Task & { assignee?: any; team?: any })[]
  artisans: { id: string; full_name: string | null; trade: string | null; color: string | null }[]
}) {
  return (
    <div className="p-5 lg:p-8 flex flex-col gap-5">
      {/* Équipes affectées */}
      {projectTeams.length > 0 && (
        <DashTile title="Équipes affectées" badge={projectTeams.length}>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projectTeams.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-elevated/30 border border-border/25">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: (t.color ?? '#94a3b8') + '22', border: `2px solid ${t.color ?? '#94a3b8'}` }}
                >
                  <Users className="h-4 w-4" style={{ color: t.color ?? '#94a3b8' }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-600 text-foreground truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.memberCount} membre{t.memberCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </DashTile>
      )}

      {/* Artisans avec tâches */}
      <DashTile
        title="Artisans actifs"
        badge={team.length || undefined}
        action={
          <Link href="/equipes" className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-1 transition-colors">
            Gérer <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        }
      >
        {team.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <Users className="h-8 w-8 text-muted-foreground/25" />
            <p className="text-[12px] text-muted-foreground">Aucun artisan assigné sur ce chantier.</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3 px-5 py-2.5 border-b border-border/40 bg-foreground/[0.02]">
              <span className="text-[9.5px] font-800 uppercase tracking-wider text-slate-600 dark:text-slate-300">Artisan</span>
              <span className="text-[9.5px] font-800 uppercase tracking-wider text-slate-600 dark:text-slate-300">Rôle</span>
              <span className="text-[9.5px] font-800 uppercase tracking-wider text-slate-600 dark:text-slate-300">Tâches</span>
              <span className="text-[9.5px] font-800 uppercase tracking-wider text-slate-600 dark:text-slate-300">Statut</span>
            </div>
            <div className="divide-y divide-border/30">
              {team.map(m => (
                <div key={m.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-foreground/[0.02] transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full text-white text-[10px] font-700 flex items-center justify-center shrink-0" style={{ background: m.color }}>
                      {getInitials(m.name)}
                    </div>
                    <span className="text-[12.5px] font-600 text-foreground truncate">{m.name}</span>
                  </div>
                  <span className="text-[11.5px] text-slate-600 dark:text-slate-400 truncate font-500">{m.trade ?? '—'}</span>
                  <span className="text-[12px] font-700 text-foreground tabular-nums">{m.taskCount}</span>
                  <span className={cn('text-[9px] font-700 px-2 py-0.5 rounded-full whitespace-nowrap',
                    m.taskCount > 1
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                      : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
                  )}>
                    {m.taskCount > 1 ? 'Multi' : 'Affecté'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </DashTile>
    </div>
  )
}

// ── Photos Tab ────────────────────────────────────────────────────────────────

function PhotoCard({ photo }: { photo: Photo & { taken_by_profile?: any } }) {
  const [hasError, setHasError] = useState(false)
  const src = hasError ? null : resolveDemoImageSrc(photo.thumbnail_url ?? photo.url, photo.caption)

  if (!src) {
    return (
      <div className="aspect-square rounded-xl bg-elevated/60 border border-border/20 dark:border-white/[0.06] flex flex-col items-center justify-center gap-1.5">
        <ImageOff className="h-5 w-5 text-muted-foreground/30" />
        <p className="text-[9px] text-muted-foreground/40 text-center px-1.5 leading-tight">Indisponible</p>
      </div>
    )
  }

  return (
    <div className="aspect-square rounded-xl overflow-hidden bg-elevated relative group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={photo.caption ?? 'Photo chantier'}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
        onError={() => setHasError(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-70 rounded-xl transition-opacity" />
      {photo.caption && (
        <div className="absolute bottom-1.5 inset-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[9px] text-white font-500 truncate px-1 drop-shadow">{photo.caption}</p>
        </div>
      )}
    </div>
  )
}

function PhotosTab({ photos, documents }: { photos: (Photo & { taken_by_profile?: any })[]; documents: Document[] }) {
  return (
    <div className="p-5 lg:p-8 flex flex-col gap-5">
      {/* Photos */}
      <DashTile
        title="Photos"
        badge={photos.length || undefined}
        action={
          <Link href="/documents" className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-1 transition-colors">
            Tous les documents <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        }
      >
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <ImageOff className="h-8 w-8 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground">Aucune photo sur ce chantier.</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {photos.map(photo => (
                <PhotoCard key={photo.id} photo={photo} />
              ))}
            </div>
          </div>
        )}
      </DashTile>

      {/* Documents */}
      <DashTile title="Documents" badge={documents.length || undefined}>
        {documents.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
              <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />
            </div>
            <p className="text-[12px] text-muted-foreground">Aucun document ajouté</p>
          </div>
        ) : (
          <div className="divide-y divide-border/15 dark:divide-white/[0.04]">
            {documents.map(doc => (
              <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 px-5 py-3 hover:bg-elevated/35 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-600 text-foreground truncate">{doc.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(doc.created_at)}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
            ))}
          </div>
        )}
      </DashTile>
    </div>
  )
}

// ── Messagerie Tab — side-window UX ──────────────────────────────────────────

function MessagerieTab({
  initialMessages, currentUserId, projectId, orgId,
}: {
  initialMessages: (Message & { sender?: any })[]
  currentUserId: string
  projectId: string
  orgId: string
}) {
  const { toast } = useToast()
  const [localMessages, setLocalMessages] = useState<(Message & { sender?: any })[]>(
    [...initialMessages].reverse()
  )
  const [panelOpen, setPanelOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [msgInput, setMsgInput] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const msgEndRef = useRef<HTMLDivElement | null>(null)

  function openPanel() {
    setPanelOpen(true)
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'instant' }), 80)
  }
  function closePanel() {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => { setPanelOpen(false); setIsClosing(false) }, 240)
  }

  async function handleSend() {
    const content = msgInput.trim()
    if (!content || msgSending) return
    setMsgSending(true)
    const { data, error } = await mutationClient().from('messages').insert({
      project_id: projectId,
      org_id: orgId,
      sender_id: currentUserId,
      content,
      type: 'text',
      metadata: {},
    }).select('*, sender:profiles!sender_id(full_name,avatar_url)').single()
    setMsgSending(false)
    if (error) { toast(error.message, 'error'); return }
    if (data) {
      setLocalMessages(prev => [...prev, data as Message & { sender?: any }])
      setMsgInput('')
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const recentForList = [...localMessages].reverse().slice(0, 12)

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Tab list header */}
        <div className="shrink-0 px-5 py-3 border-b border-border/25 flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest">Messagerie chantier</span>
            {localMessages.length > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-primary/15 text-primary text-[9px] font-700 flex items-center justify-center px-1 leading-none">
                {localMessages.length}
              </span>
            )}
          </div>
          <Link
            href="/messages"
            className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-0.5 transition-colors"
          >
            Vue complète <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Compact message list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/[0.15] dark:divide-white/[0.04]">
          {recentForList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
              <div className="text-center">
                <p className="text-sm font-600 text-foreground">Aucun message</p>
                <p className="text-xs text-muted-foreground mt-0.5">Commencez une conversation sur ce chantier.</p>
              </div>
            </div>
          ) : (
            recentForList.map(msg => {
              const isMe = msg.sender_id === currentUserId
              const senderName = msg.sender?.full_name ?? 'Équipe'
              const color = isMe ? '#6366f1' : avatarColor(senderName)
              const meta = MSG_TYPE_META[msg.type] ?? MSG_TYPE_META['text']
              return (
                <button
                  key={msg.id}
                  onClick={openPanel}
                  className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-elevated/35 dark:hover:bg-elevated/60 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full text-white text-[11px] font-700 flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: color }}
                  >
                    {getInitials(senderName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 mb-0.5">
                      <span className="text-[13px] font-700 text-foreground truncate">{isMe ? 'Moi' : senderName}</span>
                      {meta && msg.type !== 'text' && (
                        <span className={cn('text-[9px] font-700 px-1.5 py-0.5 rounded-full shrink-0', meta.pill)}>
                          {meta.label}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 shrink-0 whitespace-nowrap ml-auto">
                        {formatRelative(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground/70 line-clamp-1">{msg.content}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Input bar — opens panel */}
        <div className="shrink-0 px-4 py-3 border-t border-border/20 dark:border-white/[0.05]">
          <button onClick={openPanel} className="flex items-center gap-2 w-full">
            <div className="flex-1 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-elevated/60 border border-border/25 dark:border-white/[0.07] hover:bg-elevated/80 transition-colors">
              <span className="text-[12px] text-muted-foreground/45 flex-1 text-left">Écrire un message…</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#25d366] hover:bg-[#22c55e] transition-colors flex items-center justify-center shrink-0 shadow-[0_2px_6px_rgba(37,211,102,0.30)]">
              <Send className="h-3.5 w-3.5 text-white" />
            </div>
          </button>
        </div>
      </div>

      {/* ── Side panel ── */}
      {panelOpen && (
        <>
          <div
            className={cn('fixed inset-0 bg-black/20 dark:bg-black/50 z-[150]', isClosing ? 'backdrop-exit' : 'backdrop-enter')}
            onClick={closePanel}
          />
          <div className={cn(
            'fixed top-0 right-0 bottom-0 z-[151] flex flex-col',
            'w-[420px] max-w-[92vw] bg-surface border-l border-border/40 dark:border-white/[0.09]',
            'msg-panel-shadow',
            isClosing ? 'task-panel-exit' : 'task-panel-enter',
          )}>
            {/* Panel header */}
            <div className="shrink-0 px-4 py-3.5 border-b border-border/25 flex items-center gap-3 bg-surface">
              <div className="w-8 h-8 rounded-xl bg-[#25d366]/15 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-[#25d366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-700 text-foreground leading-tight">Messagerie chantier</p>
                <p className="text-[10.5px] text-muted-foreground/60 leading-tight">
                  {localMessages.length} message{localMessages.length > 1 ? 's' : ''}
                </p>
              </div>
              <Link
                href="/messages"
                className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-0.5 mr-2 transition-colors"
              >
                Vue complète <ExternalLink className="h-2.5 w-2.5" />
              </Link>
              <button
                onClick={closePanel}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto messages-bg px-3 py-3">
              {localMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">Aucun message sur ce chantier.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {localMessages.map((msg, i) => {
                    const isMe = msg.sender_id === currentUserId
                    const senderName = msg.sender?.full_name ?? 'Équipe'
                    const showSender = !isMe && (i === 0 || localMessages[i - 1]?.sender_id !== msg.sender_id)
                    const meta = MSG_TYPE_META[msg.type] ?? null
                    return (
                      <div key={msg.id} className={cn('flex gap-2 items-end', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        {!isMe && (
                          <div className="w-6 h-6 shrink-0">
                            {showSender && (
                              <div
                                className="w-6 h-6 rounded-full text-white text-[9px] font-700 flex items-center justify-center"
                                style={{ background: avatarColor(senderName) }}
                              >
                                {getInitials(senderName)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className={cn('flex flex-col max-w-[78%]', isMe ? 'items-end' : 'items-start')}>
                          {showSender && (
                            <span className="text-[10px] font-600 text-muted-foreground/70 mb-0.5 px-1">{senderName}</span>
                          )}
                          <div className={cn(
                            'px-3 py-2 text-[12.5px] leading-relaxed',
                            isMe
                              ? 'bg-[#25d366] dark:bg-[#128c7e] text-white rounded-2xl rounded-tr-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.22)]'
                              : 'bg-white dark:bg-[#1f2c34] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-[4px] shadow-[0_1px_2px_rgba(0,0,0,0.12)]',
                          )}>
                            {msg.type !== 'text' && meta && (
                              <span className={cn('inline-block text-[9px] font-700 px-1.5 py-0.5 rounded mb-1 mr-1', meta.pill)}>
                                {meta.label}
                              </span>
                            )}
                            <span>{msg.content}</span>
                          </div>
                          <div className={cn('flex items-center gap-1 mt-0.5 px-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
                            <span className="text-[9.5px] text-muted-foreground/50">{formatRelative(msg.created_at)}</span>
                            {isMe && <CheckCheck className="h-2.5 w-2.5 text-muted-foreground/40" />}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={msgEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 px-3 py-3 border-t border-border/25 dark:border-white/[0.06] bg-surface">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-elevated/60 border border-border/30 dark:border-white/[0.07] focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Écrire un message…"
                    className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/45 outline-none min-w-0"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!msgInput.trim() || msgSending}
                  className="w-9 h-9 rounded-2xl bg-[#25d366] hover:bg-[#22c55e] disabled:opacity-40 transition-colors flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(37,211,102,0.35)]"
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Réserves Tab ──────────────────────────────────────────────────────────────

function ReservesTab({
  issues, highlightIssueId, resolveLoadingId,
  onEdit, onResolve, onAdd,
}: {
  issues: (Issue & { artisan?: any })[]
  highlightIssueId: string | null
  resolveLoadingId: string | null
  onEdit: (i: Issue & { artisan?: any }) => void
  onResolve: (i: Issue & { artisan?: any }) => void
  onAdd: () => void
}) {
  const open   = issues.filter(i => i.status !== 'fixed' && i.status !== 'validated' && i.status !== 'rejected')
  const closed = issues.filter(i => i.status === 'fixed' || i.status === 'validated' || i.status === 'rejected')

  return (
    <div className="p-5 lg:p-8 flex flex-col gap-5">
      <DashTile
        title="Réserves ouvertes"
        badge={open.length || undefined}
        badgeColor="orange"
        urgent={open.length > 0}
        action={
          <button onClick={onAdd} className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-600 transition-colors">
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        }
      >
        {open.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-[12px] text-muted-foreground">Aucune réserve ouverte — tout est sous contrôle.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/15 dark:divide-white/[0.04]">
            {open.map(issue => {
              const isResolved = issue.status === 'fixed' || issue.status === 'validated'
              return (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  highlighted={highlightIssueId === issue.id}
                  isResolved={isResolved}
                  loading={resolveLoadingId === issue.id}
                  onEdit={() => onEdit(issue)}
                  onResolve={() => onResolve(issue)}
                />
              )
            })}
          </div>
        )}
      </DashTile>

      {closed.length > 0 && (
        <DashTile title="Réserves résolues" badge={closed.length}>
          <div className="divide-y divide-border/15 dark:divide-white/[0.04]">
            {closed.map(issue => (
              <IssueRow
                key={issue.id}
                issue={issue}
                highlighted={false}
                isResolved={true}
                loading={resolveLoadingId === issue.id}
                onEdit={() => onEdit(issue)}
                onResolve={() => onResolve(issue)}
              />
            ))}
          </div>
        </DashTile>
      )}
    </div>
  )
}

function IssueRow({
  issue, highlighted, isResolved, loading, onEdit, onResolve,
}: {
  issue: Issue & { artisan?: any }
  highlighted: boolean
  isResolved: boolean
  loading: boolean
  onEdit: () => void
  onResolve: () => void
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-5 py-3.5 group hover:bg-elevated/35 transition-colors',
      highlighted && 'bg-primary/[0.06] ring-1 ring-inset ring-primary/30',
    )}>
      <div className={cn('w-2 h-2 rounded-full shrink-0', {
        'bg-red-500':             issue.priority === 'critical',
        'bg-orange-500':          issue.priority === 'high',
        'bg-yellow-500':          issue.priority === 'medium',
        'bg-slate-300 dark:bg-slate-600': !issue.priority || issue.priority === 'low',
      })} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-600 truncate', isResolved ? 'text-muted-foreground line-through' : 'text-foreground')}>{issue.title}</p>
        {issue.artisan && <p className="text-[11px] text-muted-foreground">{issue.artisan.full_name}</p>}
      </div>
      <span className={cn('text-[10px] font-700 px-2 py-0.5 rounded-full shrink-0', {
        'bg-red-500/10 text-red-600 dark:text-red-400':          issue.priority === 'critical',
        'bg-orange-500/10 text-orange-600 dark:text-orange-400': issue.priority === 'high',
        'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500': issue.priority === 'medium',
        'bg-slate-100 dark:bg-slate-800 text-slate-500':         !issue.priority || issue.priority === 'low',
      })}>
        {issuePriorityLabel(issue.priority)}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-elevated rounded-lg transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onResolve}
          disabled={loading}
          className={cn('p-1.5 rounded-lg transition-colors disabled:opacity-40', isResolved
            ? 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10')}
        >
          {isResolved ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ── Shared UI components ──────────────────────────────────────────────────────

function DashTile({
  title, badge, badgeColor, action, children, urgent = false,
}: {
  title: string
  badge?: number
  badgeColor?: 'red' | 'orange' | 'blue'
  action?: React.ReactNode
  children: React.ReactNode
  urgent?: boolean
}) {
  return (
    <div className={cn(
      'dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08]',
      'shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden',
      urgent && 'border-orange-500/30 dark:border-orange-500/25',
    )}>
      <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">{title}</h2>
          {badge !== undefined && badge > 0 && (
            <span className={cn('min-w-[20px] h-5 rounded-full text-white text-[10px] font-700 flex items-center justify-center px-1.5 leading-none', {
              'bg-red-500':          badgeColor === 'red',
              'bg-orange-500':       badgeColor === 'orange',
              'bg-primary':          !badgeColor || badgeColor === 'blue',
            })}>
              {badge}
            </span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function KpiTile({
  label, value, icon: Icon, color, alert = false, small = false,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: 'blue' | 'orange' | 'red' | 'green'
  alert?: boolean
  small?: boolean
}) {
  const palette = {
    blue:   { bubble: 'bg-primary/10 text-primary',         num: 'text-primary' },
    orange: { bubble: 'bg-orange-500/10 text-orange-500',   num: 'text-orange-500' },
    red:    { bubble: 'bg-red-500/10 text-red-500',         num: 'text-red-500' },
    green:  { bubble: 'bg-green-500/10 text-green-500',     num: 'text-green-500' },
  }
  const col = palette[color]
  return (
    <div className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center gap-3 px-5 py-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', col.bubble)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className={cn(
          'font-extrabold tabular-nums leading-none tracking-tight',
          small ? 'text-lg' : 'text-2xl',
          alert ? col.num : 'text-foreground',
        )}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{label}</p>
      </div>
    </div>
  )
}

const STATUS_PILL: Record<string, string> = {
  todo:        'bg-slate-200   dark:bg-slate-700   text-slate-700 dark:text-slate-200',
  in_progress: 'bg-blue-100    dark:bg-blue-900/70 text-blue-800  dark:text-blue-200',
  review:      'bg-amber-100   dark:bg-amber-900/70 text-amber-800 dark:text-amber-200',
  done:        'bg-green-100   dark:bg-green-900/70 text-green-800 dark:text-green-200',
  validated:   'bg-green-100   dark:bg-green-900/70 text-green-700 dark:text-green-200',
  blocked:     'bg-orange-100  dark:bg-orange-900/70 text-orange-800 dark:text-orange-200',
}
const STATUS_LABEL: Record<string, string> = {
  todo: 'À faire', in_progress: 'En cours', review: 'À valider',
  done: 'Terminé', validated: 'Validé', blocked: 'Bloqué',
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL[status] ?? STATUS_PILL.todo
  const label = STATUS_LABEL[status] ?? status
  return (
    <span className={cn('text-[9px] font-700 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 uppercase tracking-wide', cls)}>
      {label}
    </span>
  )
}
