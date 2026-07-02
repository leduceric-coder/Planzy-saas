'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Flag, AlertOctagon, Clock, AlertTriangle, CheckCircle2,
  FileText, Globe, BarChart3, Search, ChevronRight,
  ArrowRight, Shield, Building2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NouveauRapportButton } from './NouveauRapportButton'
import { cn, formatDate } from '@/lib/utils'

// ── Shared types (imported by page.tsx) ───────────────────────────────────────

export type AlertKind = 'critical_issue' | 'high_issue' | 'blocked_task' | 'late_task'

export interface AlertEntry {
  id: string
  kind: AlertKind
  title: string
  projectName: string | null
  projectColor: string | null
  projectId: string
  date: string | null
  daysLate: number | null
}

// ── Local types ───────────────────────────────────────────────────────────────

interface KpiData {
  criticalCount: number
  openIssuesCount: number
  lateTasksCount: number
  atRiskCount: number
}

interface ReportRow {
  id: string
  title: string | null
  type: string | null
  created_at: string | null
  project: { name: string | null; color: string } | null
  author: { full_name: string | null } | null
}

interface Props {
  orgId: string
  userId: string
  projects: { id: string; name: string; color: string }[]
  alerts: AlertEntry[]
  kpis: KpiData
  reports: ReportRow[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

type ActiveFilter = 'all' | 'critiques' | 'reserves' | 'retards' | 'bloquees'

const FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: 'all',       label: 'Toutes' },
  { value: 'critiques', label: 'Critiques' },
  { value: 'reserves',  label: 'Réserves' },
  { value: 'retards',   label: 'Retards' },
  { value: 'bloquees',  label: 'Bloquées' },
]

const KIND_CONFIG: Record<AlertKind, {
  label: string
  Icon: React.ElementType
  pill: string
  border: string
  iconCls: string
  iconBg: string
  cta: string
}> = {
  critical_issue: {
    label: 'Réserve critique',
    Icon: Flag,
    pill: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    border: 'border-l-red-500',
    iconCls: 'text-red-500',
    iconBg: 'bg-red-500/10',
    cta: 'Voir la réserve',
  },
  blocked_task: {
    label: 'Tâche bloquée',
    Icon: AlertOctagon,
    pill: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    border: 'border-l-orange-500',
    iconCls: 'text-orange-500',
    iconBg: 'bg-orange-500/10',
    cta: 'Voir la tâche',
  },
  late_task: {
    label: 'Retard',
    Icon: Clock,
    pill: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    border: 'border-l-amber-500',
    iconCls: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    cta: 'Voir la tâche',
  },
  high_issue: {
    label: 'Réserve haute priorité',
    Icon: AlertTriangle,
    pill: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    border: 'border-l-yellow-500',
    iconCls: 'text-yellow-500',
    iconBg: 'bg-yellow-500/10',
    cta: 'Voir la réserve',
  },
}

const PRIORITY_ORDER: Record<AlertKind, number> = {
  critical_issue: 0,
  blocked_task: 1,
  late_task: 2,
  high_issue: 3,
}

const TYPE_LABEL: Record<string, string> = {
  weekly: 'Hebdo',
  monthly: 'Mensuel',
  custom: 'Ponctuel',
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  value, label, icon: Icon, sub, accent = false,
}: {
  value: React.ReactNode
  label: string
  icon: React.ElementType
  sub?: string | null
  accent?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-border/40 dark:border-white/[0.08] px-4 py-4 flex items-center gap-3 min-h-[80px] shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        accent ? 'bg-red-500/12 text-red-500' : 'bg-primary/10 text-primary',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[20px] font-800 text-foreground leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{label}</p>
        {sub && (
          <p className={cn('text-[10px] mt-0.5 truncate', accent ? 'text-red-500/80' : 'text-muted-foreground/55')}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert, compact = false }: { alert: AlertEntry; compact?: boolean }) {
  const cfg = KIND_CONFIG[alert.kind]
  const Icon = cfg.Icon

  return (
    <Link
      href={`/chantiers/${alert.projectId}`}
      className={cn(
        'group flex items-start gap-3 border-l-[3px] px-4 rounded-r-xl bg-surface',
        'hover:bg-elevated/40 transition-colors',
        'border border-border/30 dark:border-white/[0.06]',
        cfg.border,
        compact ? 'py-2.5' : 'py-3',
      )}
    >
      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.iconBg)}>
        <Icon className={cn('h-3 w-3', cfg.iconCls)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={cn(
            'inline-flex items-center text-[9.5px] font-700 px-1.5 py-0.5 rounded-full border',
            cfg.pill,
          )}>
            {cfg.label}
          </span>
          {alert.projectName && (
            <span className="text-[11px] text-muted-foreground/60 truncate max-w-[140px]">
              {alert.projectName}
            </span>
          )}
        </div>
        <p className="text-[13px] font-600 text-foreground truncate leading-snug">{alert.title}</p>
        {alert.kind === 'late_task' && alert.daysLate != null && alert.daysLate > 0 && (
          <p className="text-[10.5px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
            {alert.daysLate}j de retard
          </p>
        )}
      </div>
      <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-600 text-muted-foreground/50 group-hover:text-primary transition-colors mt-1 whitespace-nowrap">
        {cfg.cta} <ArrowRight className="h-2.5 w-2.5" />
      </span>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RapportsClient({ orgId, userId, projects, alerts, kpis, reports }: Props) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAllAlerts, setShowAllAlerts] = useState(false)

  // ── Priority items (top 5 by severity) ───────────────────────────────────

  const priorityItems = useMemo(() =>
    [...alerts]
      .sort((a, b) => {
        const diff = PRIORITY_ORDER[a.kind] - PRIORITY_ORDER[b.kind]
        if (diff !== 0) return diff
        if (a.kind === 'late_task' && b.kind === 'late_task') {
          return (b.daysLate ?? 0) - (a.daysLate ?? 0)
        }
        return 0
      })
      .slice(0, 5),
    [alerts]
  )

  // ── Filtered alerts ───────────────────────────────────────────────────────

  const filteredAlerts = useMemo(() => {
    let list = alerts
    if (activeFilter === 'critiques') list = list.filter(a => a.kind === 'critical_issue' || a.kind === 'blocked_task')
    if (activeFilter === 'reserves')  list = list.filter(a => a.kind === 'critical_issue' || a.kind === 'high_issue')
    if (activeFilter === 'retards')   list = list.filter(a => a.kind === 'late_task')
    if (activeFilter === 'bloquees')  list = list.filter(a => a.kind === 'blocked_task')
    if (filterProjectId) list = list.filter(a => a.projectId === filterProjectId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.projectName ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [alerts, activeFilter, filterProjectId, search])

  const visibleAlerts = showAllAlerts ? filteredAlerts : filteredAlerts.slice(0, 15)

  const filterCounts: Record<ActiveFilter, number> = useMemo(() => ({
    all:       alerts.length,
    critiques: alerts.filter(a => a.kind === 'critical_issue' || a.kind === 'blocked_task').length,
    reserves:  alerts.filter(a => a.kind === 'critical_issue' || a.kind === 'high_issue').length,
    retards:   alerts.filter(a => a.kind === 'late_task').length,
    bloquees:  alerts.filter(a => a.kind === 'blocked_task').length,
  }), [alerts])

  const allClear = alerts.length === 0

  return (
    <div className="px-6 lg:px-10 py-6 flex flex-col gap-6">

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          icon={AlertOctagon}
          value={kpis.criticalCount}
          label="Alertes critiques"
          sub={kpis.criticalCount > 0 ? 'Réserves critiques + blocages' : 'Aucune alerte critique'}
          accent={kpis.criticalCount > 0}
        />
        <KpiTile
          icon={Flag}
          value={kpis.openIssuesCount}
          label="Réserves ouvertes"
          sub={kpis.openIssuesCount > 0 ? 'Non clôturées' : 'Tout est traité'}
          accent={kpis.openIssuesCount > 0}
        />
        <KpiTile
          icon={Clock}
          value={kpis.lateTasksCount}
          label="Tâches en retard"
          sub={kpis.lateTasksCount > 0 ? 'Échéance dépassée' : 'Aucun retard'}
        />
        <KpiTile
          icon={Building2}
          value={kpis.atRiskCount}
          label="Chantiers à risque"
          sub={kpis.atRiskCount > 0
            ? `Sur ${projects.length} chantier${projects.length > 1 ? 's' : ''}`
            : 'Tous les chantiers sont OK'}
        />
      </div>

      {/* ── À traiter en priorité ── */}
      <section className="bg-surface rounded-2xl border border-border/40 dark:border-white/[0.08] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
        <div className="px-5 py-3 border-b border-border/25 dark:border-white/[0.06] flex items-center gap-2.5">
          <AlertOctagon className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground flex-1">
            À traiter en priorité
          </h2>
          {priorityItems.length > 0 && (
            <span className="min-w-[20px] h-5 rounded-full bg-red-500/12 text-red-600 dark:text-red-400 text-[10px] font-700 flex items-center justify-center px-1.5 border border-red-500/20">
              {priorityItems.length}
            </span>
          )}
        </div>
        {allClear || priorityItems.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2.5 text-center">
            <div className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm font-700 text-foreground">Tout est sous contrôle</p>
            <p className="text-[12px] text-muted-foreground/55">Aucune alerte prioritaire détectée.</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-2">
            {priorityItems.map(alert => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </section>

      {/* ── Alertes filtrables ── */}
      <section className="bg-surface rounded-2xl border border-border/40 dark:border-white/[0.08] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
        {/* Header + filtres */}
        <div className="px-5 pt-4 pb-3 border-b border-border/25 dark:border-white/[0.06] flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground flex-1">
              Toutes les alertes
            </h2>
            <span className="text-[10px] text-muted-foreground/40">
              {filteredAlerts.length} résultat{filteredAlerts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => { setActiveFilter(f.value); setShowAllAlerts(false) }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-600 transition-colors border',
                  activeFilter === f.value
                    ? 'bg-foreground text-background border-transparent'
                    : 'bg-elevated/50 text-muted-foreground border-border/40 hover:bg-elevated hover:text-foreground',
                )}
              >
                {f.label}
                {filterCounts[f.value] > 0 && (
                  <span className={cn(
                    'text-[9px] font-700 min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 tabular-nums',
                    activeFilter === f.value
                      ? 'bg-white/20 text-background'
                      : 'bg-foreground/8 text-muted-foreground',
                  )}>
                    {filterCounts[f.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search + project select */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une alerte…"
                className="w-full pl-8 pr-8 h-8 rounded-lg bg-elevated border border-border/40 dark:border-white/[0.08] text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            {projects.length > 0 && (
              <select
                value={filterProjectId ?? ''}
                onChange={e => setFilterProjectId(e.target.value || null)}
                className="h-8 px-2.5 rounded-lg bg-elevated border border-border/40 dark:border-white/[0.08] text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="">Tous les chantiers</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Alerts list */}
        {visibleAlerts.length === 0 ? (
          <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-7 w-7 text-green-500/40" />
            <p className="text-[12px] text-muted-foreground/50 italic">Aucune alerte pour ces filtres</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-2">
            {visibleAlerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} compact />
            ))}
            {!showAllAlerts && filteredAlerts.length > 15 && (
              <button
                onClick={() => setShowAllAlerts(true)}
                className="mt-1 flex items-center justify-center gap-1 text-[11px] font-600 text-primary hover:text-primary/80 transition-colors py-2"
              >
                Voir {filteredAlerts.length - 15} alertes supplémentaires
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Rapports disponibles ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">
          Rapports disponibles
        </h2>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Rapport global */}
          <div className="bg-surface border border-border/40 dark:border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4 dashboard-tile">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-700 text-foreground text-sm">Rapport global</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Vision multi-chantiers, KPI et activité récente
                </p>
              </div>
            </div>
            <Link href="/rapports/global" className="block">
              <Button size="sm" className="w-full">Ouvrir le rapport global</Button>
            </Link>
          </div>

          {/* Rapport chantier */}
          <div className="bg-surface border border-border/40 dark:border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4 dashboard-tile">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-700 text-foreground text-sm">Rapport chantier</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Rapport détaillé par chantier et par période
                </p>
              </div>
            </div>
            <NouveauRapportButton orgId={orgId} userId={userId} projects={projects} />
          </div>
        </div>

        {/* Reports history */}
        {reports.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border/40 dark:border-white/[0.08] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
            <div className="px-5 py-3 border-b border-border/25 dark:border-white/[0.06] flex items-center gap-2.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <h3 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground flex-1">
                Historique des rapports
              </h3>
              <span className="text-[10px] text-muted-foreground/40">{reports.length}</span>
            </div>
            <div className="divide-y divide-border/20 dark:divide-white/[0.04]">
              {reports.slice(0, 10).map(r => (
                <Link
                  key={r.id}
                  href={`/rapports/${r.id}`}
                  className="group flex items-center gap-3.5 px-5 py-3 hover:bg-elevated/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-600 text-foreground truncate">{r.title ?? 'Rapport'}</p>
                    <div className="flex items-center gap-2.5 mt-0.5">
                      {r.project?.name && (
                        <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground/60 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.project.color }} />
                          {r.project.name}
                        </span>
                      )}
                      <span className="text-[10.5px] text-muted-foreground/40">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.type && (
                      <span className="text-[10px] font-600 px-2 py-0.5 rounded-lg bg-elevated border border-border/30 text-muted-foreground">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {reports.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center border border-dashed border-border/40 rounded-2xl">
            <BarChart3 className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-[12px] text-muted-foreground/50 italic">Aucun rapport généré pour l'instant</p>
          </div>
        )}
      </section>

    </div>
  )
}
