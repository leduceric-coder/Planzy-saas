'use client'

import Link from 'next/link'
import { Printer, AlertTriangle, Clock, Lock, FileText, BarChart3 } from 'lucide-react'
import { cn, formatDate, formatRelative } from '@/lib/utils'
import { PhotoThumb } from '@/components/ui/PhotoThumb'

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProjectStat {
  id: string
  name: string
  color: string
  progress: number
  status: string
  start_date: string | null
  end_date: string | null
  taskTotal: number
  taskTodo: number
  taskInProgress: number
  taskDone: number
  taskBlocked: number
  taskLate: number
  issueOpen: number
  issueCritical: number
  nextDeadlineTitle: string | null
  nextDeadline: string | null
}

interface AlertItem {
  type: 'critical_issue' | 'blocked_task' | 'late_task'
  title: string
  projectName: string
  projectColor: string
  date: string | null
  priority?: string | null
}

interface ActivityItem {
  id: string
  action: string
  entity_type: string
  created_at: string
  projectName: string | null
  projectColor: string | null
  authorName: string | null
}

interface RecentDoc {
  id: string
  name: string
  projectName: string | null
  projectColor: string | null
  created_at: string
  category: string | null
}

interface RecentPhoto {
  id: string
  url: string
  projectName: string | null
  caption: string | null
  taken_at: string
}

interface Props {
  projectStats: ProjectStat[]
  alertItems: AlertItem[]
  activityItems: ActivityItem[]
  recentDocs: RecentDoc[]
  recentPhotos: RecentPhoto[]
  generatedAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: 'En cours',
  paused: 'En pause',
  completed: 'Terminé',
  archived: 'Archivé',
}

const ENTITY_LABEL: Record<string, string> = {
  task: 'tâche',
  issue: 'réserve',
  document: 'document',
  photo: 'photo',
  project: 'chantier',
  message: 'message',
  report: 'rapport',
}

const ACTION_LABEL: Record<string, string> = {
  created: 'Créé',
  updated: 'Modifié',
  deleted: 'Supprimé',
  status_changed: 'Statut mis à jour',
  uploaded: 'Uploadé',
  commented: 'Commenté',
}

const ALERT_CONFIG = {
  critical_issue: {
    label: 'Réserve critique',
    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertTriangle,
  },
  blocked_task: {
    label: 'Tâche bloquée',
    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    icon: Lock,
  },
  late_task: {
    label: 'Tâche en retard',
    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock,
  },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">
      {title}
    </h2>
  )
}

function KpiCard({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 text-center">
      <div
        className="text-2xl font-800 mb-0.5"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RapportGlobalView({
  projectStats,
  alertItems,
  activityItems,
  recentDocs,
  recentPhotos,
  generatedAt,
}: Props) {
  // Computed KPIs
  const totalActive = projectStats.length
  const totalInProgress = projectStats.reduce((s, p) => s + p.taskInProgress, 0)
  const totalLate = projectStats.reduce((s, p) => s + p.taskLate, 0)
  const totalBlocked = projectStats.reduce((s, p) => s + p.taskBlocked, 0)
  const totalIssuesOpen = projectStats.reduce((s, p) => s + p.issueOpen, 0)
  const totalIssuesCritical = projectStats.reduce((s, p) => s + p.issueCritical, 0)

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1.5cm 1.5cm 2cm 1.5cm; }
          body, html { background: white !important; color: #1a1a1a !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-surface/95 backdrop-blur-sm border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/rapports" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Rapports
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-600 text-foreground">Rapport global</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Exporter en PDF
        </button>
      </div>

      {/* Report body */}
      <div className="flex-1 overflow-y-auto px-6 pb-10 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 py-8 border-b border-border mb-8">
          <div>
            <p className="text-[11px] font-700 uppercase tracking-widest text-muted-foreground mb-2">
              Rapport global multi-chantiers
            </p>
            <h1 className="text-2xl font-800 text-foreground">Synthèse portefeuille</h1>
            <p className="text-sm text-muted-foreground mt-1">{totalActive} chantier{totalActive > 1 ? 's' : ''} actif{totalActive > 1 ? 's' : ''}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Généré le {formatDate(generatedAt)}</p>
          </div>
        </div>

        {/* A. Synthèse générale */}
        <section className="mb-10">
          <SectionTitle title="Synthèse générale" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard value={totalActive} label="Chantiers actifs" />
            <KpiCard value={totalInProgress} label="Tâches en cours" color="#2563EB" />
            <KpiCard value={totalLate} label="Tâches en retard" color="#EF4444" />
            <KpiCard value={totalBlocked} label="Tâches bloquées" color="#D97706" />
            <KpiCard value={totalIssuesOpen} label="Réserves ouvertes" color="#D97706" />
            <KpiCard value={totalIssuesCritical} label="Réserves critiques" color="#EF4444" />
          </div>
        </section>

        {/* B. Vue par chantier */}
        <section className="mb-10">
          <SectionTitle title={`Vue par chantier (${projectStats.length})`} />
          {projectStats.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Aucun chantier actif
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectStats.map(p => {
                const daysLeft = p.end_date
                  ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000)
                  : null

                return (
                  <div key={p.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                    {/* Name + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                        <h3 className="text-sm font-600 text-foreground truncate">{p.name}</h3>
                      </div>
                      <span className={cn(
                        'text-[10px] font-600 shrink-0 px-2 py-0.5 rounded-full',
                        p.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      )}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Avancement</span>
                        <span className="font-700 text-foreground">{p.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${p.progress}%`, background: p.color }}
                        />
                      </div>
                    </div>

                    {/* Dates */}
                    {(p.start_date || p.end_date) && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {p.start_date && <span>Début : {formatDate(p.start_date)}</span>}
                        {p.end_date && (
                          <span className={cn(
                            daysLeft !== null && daysLeft < 0 ? 'text-destructive font-600' :
                            daysLeft !== null && daysLeft < 14 ? 'text-yellow-600 font-600' : ''
                          )}>
                            Fin : {formatDate(p.end_date)}
                            {daysLeft !== null && (
                              <span className="ml-1">
                                ({daysLeft < 0 ? `${Math.abs(daysLeft)}j retard` : `${daysLeft}j`})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Task counters */}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        En cours : {p.taskInProgress}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        À faire : {p.taskTodo}
                      </span>
                      {p.taskLate > 0 && (
                        <span className="flex items-center gap-1 text-destructive font-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          En retard : {p.taskLate}
                        </span>
                      )}
                      {p.taskBlocked > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 font-600 dark:text-orange-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                          Bloquées : {p.taskBlocked}
                        </span>
                      )}
                    </div>

                    {/* Issues */}
                    {p.issueOpen > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">Réserves ouvertes : {p.issueOpen}</span>
                        {p.issueCritical > 0 && (
                          <span className="text-destructive font-600">({p.issueCritical} critique{p.issueCritical > 1 ? 's' : ''})</span>
                        )}
                      </div>
                    )}

                    {/* Next deadline */}
                    {p.nextDeadline && (
                      <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
                        Prochaine échéance : <span className="font-600 text-foreground truncate">{p.nextDeadlineTitle}</span>
                        <span className="ml-1">({formatDate(p.nextDeadline)})</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* C. Points à surveiller */}
        <section className="mb-10">
          <SectionTitle title={`Points à surveiller (${alertItems.length})`} />
          {alertItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Aucun point d&apos;alerte — tout est sous contrôle
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alertItems.map((alert, i) => {
                const cfg = ALERT_CONFIG[alert.type]
                const Icon = cfg.icon
                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
                    <span className={cn('flex items-center gap-1 text-[10px] font-700 px-2 py-0.5 rounded-full shrink-0', cfg.cls)}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-foreground truncate">{alert.title}</span>
                    <span
                      className="text-xs font-500 shrink-0 flex items-center gap-1"
                      style={{ color: alert.projectColor }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: alert.projectColor }}
                      />
                      {alert.projectName}
                    </span>
                    {alert.date && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(alert.date)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* D. Activité récente */}
        {activityItems.length > 0 && (
          <section className="mb-10">
            <SectionTitle title="Activité récente" />
            <div className="flex flex-col gap-2">
              {activityItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">
                      {ACTION_LABEL[item.action] ?? item.action}{' '}
                      <span className="text-muted-foreground">
                        {ENTITY_LABEL[item.entity_type] ?? item.entity_type}
                      </span>
                    </span>
                    {item.authorName && (
                      <span className="text-xs text-muted-foreground ml-1">par {item.authorName}</span>
                    )}
                  </div>
                  {item.projectName && (
                    <span
                      className="text-xs font-500 shrink-0 flex items-center gap-1"
                      style={{ color: item.projectColor ?? undefined }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: item.projectColor ?? '#6b7280' }}
                      />
                      {item.projectName}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatRelative(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* E. Documents & Photos récents */}
        {(recentDocs.length > 0 || recentPhotos.length > 0) && (
          <section className="mb-10">
            <SectionTitle title="Documents & Photos récents" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Documents */}
              {recentDocs.length > 0 && (
                <div>
                  <h3 className="text-xs font-600 text-muted-foreground mb-3 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Documents récents
                  </h3>
                  <div className="flex flex-col gap-2">
                    {recentDocs.slice(0, 4).map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-500 text-foreground truncate">{doc.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {doc.projectName && (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: doc.projectColor ?? undefined }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: doc.projectColor ?? '#6b7280' }}
                                />
                                {doc.projectName}
                              </span>
                            )}
                            {doc.category && <span>· {doc.category}</span>}
                            <span>· {formatDate(doc.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {recentPhotos.length > 0 && (
                <div>
                  <h3 className="text-xs font-600 text-muted-foreground mb-3 flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 text-muted-foreground">📷</span>
                    Photos récentes
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {recentPhotos.slice(0, 4).map(photo => (
                      <div key={photo.id} className="aspect-video rounded-xl overflow-hidden bg-elevated border border-border relative group">
                        <PhotoThumb
                          src={photo.url}
                          caption={photo.caption}
                          alt={stripDemo(photo.caption) || 'Photo chantier'}
                          imgClassName="group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.projectName && <span className="truncate block">{stripDemo(photo.projectName)}</span>}
                          {photo.caption && <span className="truncate block">{stripDemo(photo.caption)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-5 mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Kanvix — Rapport global</span>
          <span>Généré le {formatDate(generatedAt)}</span>
        </div>

      </div>
    </>
  )
}
