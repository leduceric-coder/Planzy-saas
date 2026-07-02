'use client'

import Link from 'next/link'
import { Printer, ExternalLink } from 'lucide-react'
import { cn, formatDate, issueStatusLabel } from '@/lib/utils'
import { PhotoThumb } from '@/components/ui/PhotoThumb'

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface RapportProject {
  id: string
  name: string
  address: string | null
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  progress: number
  color: string
}

interface RapportTask {
  id: string
  title: string
  status: string
  start_date: string | null
  end_date: string | null
  priority: string | null
  description: string | null
  assignee: { full_name: string; color: string } | null
}

interface RapportIssue {
  id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  assignee: { full_name: string } | null
}

interface RapportPhoto {
  id: string
  signedUrl: string
  caption: string | null
  theme: string | null
  taken_at: string | null
}

interface RapportMessage {
  id: string
  content: string
  type: string | null
  created_at: string | null
  sender: { full_name: string | null } | null
}

interface ReportContent {
  period_start?: string
  period_end?: string
  period_label?: string
  include_photos?: boolean
  include_issues?: boolean
  include_messages?: boolean
}

interface RapportReport {
  id: string
  title: string
  type: string | null
  created_at: string | null
  content: ReportContent | null
}

interface Props {
  report: RapportReport
  project: RapportProject
  tasks: RapportTask[]
  issues: RapportIssue[]
  photos: RapportPhoto[]
  messages: RapportMessage[]
  author: { full_name: string | null } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isLate(task: RapportTask): boolean {
  return !!task.end_date && new Date(task.end_date) < new Date() && task.status !== 'done' && task.status !== 'validated'
}

const PRIORITY_LABEL: Record<string, string> = { low: 'Basse', medium: 'Normale', high: 'Haute', critical: 'Critique' }

const TASK_BADGE: Record<string, { label: string; cls: string }> = {
  late:      { label: 'En retard',     cls: 'bg-red-100 text-red-700' },
  blocked:   { label: 'Bloquée',       cls: 'bg-orange-100 text-orange-700' },
  in_progress:{ label: 'En cours',     cls: 'bg-blue-100 text-blue-700' },
  done:      { label: 'Terminée',      cls: 'bg-green-100 text-green-700' },
  validated: { label: 'Validée',       cls: 'bg-green-100 text-green-800' },
  todo:      { label: 'À faire',       cls: 'bg-gray-100 text-gray-600' },
  unplanned: { label: 'Non planifiée', cls: 'bg-gray-50 text-gray-400' },
}

const TYPE_LABEL: Record<string, string> = { weekly: 'Hebdomadaire', monthly: 'Mensuel', custom: 'Ponctuel' }

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ color, title }: { color: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-1">
      <div className="w-1 h-5 rounded-full shrink-0" style={{ background: color }} />
      <h2 className="text-[15px] font-700 text-gray-900">{title}</h2>
    </div>
  )
}

function KpiCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 text-center">
      <div className="text-2xl font-800 mb-0.5" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-600 text-gray-900">{value}</p>
    </div>
  )
}

function EmptySection({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic py-1">{text}</p>
}

function TaskGroup({ title, tasks, badgeKey }: { title: string; tasks: RapportTask[]; badgeKey: string }) {
  const badge = TASK_BADGE[badgeKey] ?? TASK_BADGE.todo
  return (
    <div className="mb-4">
      <p className="text-[11px] font-700 uppercase tracking-wider text-gray-400 mb-2">
        {title} ({tasks.length})
      </p>
      <div className="flex flex-col gap-1.5">
        {tasks.map(task => (
          <div key={task.id} className="rapport-row flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-600 shrink-0', badge.cls)}>
              {badge.label}
            </span>
            <span className={cn('flex-1 truncate font-500 text-gray-800', (badgeKey === 'done' || badgeKey === 'validated') && 'line-through text-gray-400')}>
              {task.title}
            </span>
            {task.start_date && task.end_date && (
              <span className="text-[11px] text-gray-400 shrink-0 hidden sm:block">
                {formatDate(task.start_date)} → {formatDate(task.end_date)}
              </span>
            )}
            {task.assignee && (
              <span
                className="w-5 h-5 rounded text-[9px] font-700 text-white flex items-center justify-center shrink-0"
                style={{ background: task.assignee.color }}
                title={task.assignee.full_name}
              >
                {task.assignee.full_name[0]}
              </span>
            )}
            {task.priority && task.priority !== 'medium' && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-600 shrink-0',
                task.priority === 'critical' ? 'bg-red-100 text-red-700' :
                task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-500'
              )}>
                {PRIORITY_LABEL[task.priority] ?? task.priority}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function IssueRow({ issue, resolved }: { issue: RapportIssue; resolved?: boolean }) {
  return (
    <div className={cn(
      'rapport-row flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm mb-1.5',
      resolved ? 'border-gray-100 opacity-70' : 'border-gray-200'
    )}>
      <span className={cn(
        'text-[11px] px-2 py-0.5 rounded-full font-600 shrink-0',
        resolved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
      )}>
        {issueStatusLabel(issue.status as any)}
      </span>
      <span className={cn('flex-1 truncate font-500 text-gray-800', resolved && 'line-through text-gray-400')}>
        {issue.title}
      </span>
      {issue.assignee && (
        <span className="text-[11px] text-gray-500 shrink-0">{issue.assignee.full_name}</span>
      )}
      {issue.priority && issue.priority !== 'medium' && (
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded font-600 shrink-0',
          issue.priority === 'critical' ? 'bg-red-100 text-red-700' :
          issue.priority === 'high' ? 'bg-orange-100 text-orange-700' :
          'bg-gray-100 text-gray-500'
        )}>
          {PRIORITY_LABEL[issue.priority] ?? issue.priority}
        </span>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RapportView({ report, project, tasks, issues, photos, messages, author }: Props) {
  const periodLabel = report.content?.period_label ?? 'Période non définie'
  const today = new Date()

  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'validated')
  const lateTasks = tasks.filter(t => isLate(t))
  const blockedTasks = tasks.filter(t => t.status === 'blocked')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress' && !isLate(t))
  const todoTasks = tasks.filter(t => t.status === 'todo' && !isLate(t))

  const in30Days = new Date(today.getTime() + 30 * 86400000)
  const upcomingTasks = todoTasks.filter(t => t.start_date && new Date(t.start_date) <= in30Days && t.end_date)
  const unplannedTasks = todoTasks.filter(t => !t.start_date || !t.end_date)

  const openIssues = issues.filter(i => ['open', 'assigned', 'in_progress'].includes(i.status))
  const resolvedIssues = issues.filter(i => ['fixed', 'validated'].includes(i.status))

  const includeIssues = report.content?.include_issues !== false
  const includePhotos = report.content?.include_photos !== false
  const includeMessages = !!report.content?.include_messages

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1.5cm 1.5cm 2cm 1.5cm; }
          body, html { background: white !important; color: #1a1a1a !important; }
          .no-print { display: none !important; }
          .rapport-body { background: white !important; }
          .rapport-row { break-inside: avoid; }
          .rapport-section { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Action bar (screen only) ── */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-surface/95 backdrop-blur-sm border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/rapports" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Rapports
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-600 text-foreground truncate max-w-[280px]">{report.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/chantiers/${project.id}`}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ouvrir le chantier
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Exporter en PDF
          </button>
        </div>
      </div>

      {/* ── Report body ── */}
      <div className="rapport-body flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* ═══ Header ═══ */}
          <div className="rapport-section flex items-start justify-between gap-6 pb-7 mb-7 border-b-[3px]" style={{ borderColor: project.color }}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-700 uppercase tracking-widest text-gray-400">Rapport de chantier</span>
                <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded font-600 text-gray-500">
                  {TYPE_LABEL[report.type ?? ''] ?? 'Ponctuel'}
                </span>
              </div>
              <h1 className="text-[28px] font-800 text-gray-900 leading-tight mb-1">{project.name}</h1>
              {project.address && (
                <p className="text-sm text-gray-500 mb-2">{project.address}</p>
              )}
              <p className="text-sm font-600 text-gray-700">{periodLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-700 text-gray-900 mb-1">Kanvix</p>
              <p className="text-xs text-gray-400">Généré le {formatDate(report.created_at)}</p>
              {author?.full_name && <p className="text-xs text-gray-400">par {author.full_name}</p>}
            </div>
          </div>

          {/* ═══ KPIs ═══ */}
          <div className="rapport-section grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <KpiCard value={doneTasks.length} label="Tâches terminées" color="#16A34A" />
            <KpiCard value={inProgressTasks.length} label="En cours" color="#2563EB" />
            <KpiCard value={lateTasks.length} label="En retard" color="#EF4444" />
            <KpiCard value={openIssues.length} label="Réserves ouvertes" color="#D97706" />
          </div>

          {/* ═══ Section 1 — Chantier ═══ */}
          <div className="rapport-section mb-8">
            <SectionTitle color={project.color} title="Informations chantier" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <InfoRow label="Statut" value={project.status === 'active' ? 'En cours' : project.status} />
              <InfoRow label="Avancement" value={`${project.progress}%`} />
              {project.start_date && <InfoRow label="Date de début" value={formatDate(project.start_date)} />}
              {project.end_date && <InfoRow label="Date de fin prévisionnelle" value={formatDate(project.end_date)} />}
            </div>
            {project.description && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{project.description}</p>
            )}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>Avancement global</span>
                <span className="font-700 text-gray-700">{project.progress}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: project.color }} />
              </div>
            </div>
          </div>

          {/* ═══ Section 2 — Tâches ═══ */}
          <div className="rapport-section mb-8">
            <SectionTitle color={project.color} title={`Avancement des tâches (${tasks.length})`} />
            {tasks.length === 0 ? (
              <EmptySection text="Aucune tâche sur ce chantier" />
            ) : (
              <>
                {lateTasks.length > 0 && <TaskGroup title="En retard" tasks={lateTasks} badgeKey="late" />}
                {blockedTasks.length > 0 && <TaskGroup title="Bloquées" tasks={blockedTasks} badgeKey="blocked" />}
                {inProgressTasks.length > 0 && <TaskGroup title="En cours" tasks={inProgressTasks} badgeKey="in_progress" />}
                {doneTasks.length > 0 && <TaskGroup title="Terminées" tasks={doneTasks} badgeKey="done" />}
                {upcomingTasks.length > 0 && <TaskGroup title="À venir (30 jours)" tasks={upcomingTasks} badgeKey="todo" />}
                {unplannedTasks.length > 0 && <TaskGroup title="Sans date planifiée" tasks={unplannedTasks} badgeKey="unplanned" />}
              </>
            )}
          </div>

          {/* ═══ Section 3 — Réserves ═══ */}
          {includeIssues && (
            <div className="rapport-section mb-8">
              <SectionTitle color={project.color} title={`Réserves (${issues.length})`} />
              {issues.length === 0 ? (
                <EmptySection text="Aucune réserve sur ce chantier" />
              ) : (
                <>
                  {openIssues.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-700 uppercase tracking-wider text-gray-400 mb-2">
                        Ouvertes / En cours ({openIssues.length})
                      </p>
                      {openIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
                    </div>
                  )}
                  {resolvedIssues.length > 0 && (
                    <div>
                      <p className="text-[11px] font-700 uppercase tracking-wider text-gray-400 mb-2">
                        Corrigées / Validées ({resolvedIssues.length})
                      </p>
                      {resolvedIssues.map(issue => <IssueRow key={issue.id} issue={issue} resolved />)}
                    </div>
                  )}
                  {openIssues.length === 0 && resolvedIssues.length === 0 && (
                    <EmptySection text="Aucune réserve ouverte" />
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ Section 4 — Photos ═══ */}
          {includePhotos && (
            <div className="rapport-section mb-8">
              <SectionTitle color={project.color} title={`Photos (${photos.length})`} />
              {photos.length === 0 ? (
                <EmptySection text="Aucune photo sur cette période" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map(photo => (
                    <div key={photo.id} className="rapport-row rounded-xl overflow-hidden border border-gray-200">
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        <PhotoThumb
                          src={photo.signedUrl}
                          caption={photo.caption}
                          alt={stripDemo(photo.caption) || 'Photo chantier'}
                        />
                      </div>
                      {(photo.caption || photo.theme || photo.taken_at) && (
                        <div className="p-2.5">
                          {photo.caption && <p className="text-xs font-600 text-gray-800 leading-snug line-clamp-2">{stripDemo(photo.caption)}</p>}
                          <div className="flex items-center gap-2 mt-0.5">
                            {photo.theme && <span className="text-[10px] text-gray-400">{photo.theme}</span>}
                            {photo.taken_at && <span className="text-[10px] text-gray-400">{formatDate(photo.taken_at)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Section 5 — Messages ═══ */}
          {includeMessages && messages.length > 0 && (
            <div className="rapport-section mb-8">
              <SectionTitle color={project.color} title={`Messages récents (${messages.length})`} />
              <div className="flex flex-col gap-2">
                {messages.slice(0, 10).map(msg => (
                  <div key={msg.id} className="rapport-row flex items-start gap-3 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-600 text-gray-800">{msg.sender?.full_name ?? 'Inconnu'}</span>
                        {msg.type && msg.type !== 'text' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-600 uppercase">
                            {msg.type}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{msg.content}</p>
                    </div>
                    {msg.created_at && (
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatDate(msg.created_at)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Footer ═══ */}
          <div className="rapport-section border-t border-gray-200 pt-5 mt-8 flex items-center justify-between">
            <span className="text-xs text-gray-400">Kanvix — Rapport généré le {formatDate(report.created_at)}</span>
            <span className="text-xs text-gray-400">{project.name} · {periodLabel}</span>
          </div>

        </div>
      </div>
    </>
  )
}
