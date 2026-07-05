'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Flag, AlertOctagon, Clock, AlertTriangle, CheckCircle2,
  FileText, Globe, BarChart3, Search, ChevronRight,
  ArrowRight, Shield, Building2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompactKpiCard } from '@/components/ui/CompactKpiCard'
import { PageSection } from '@/components/ui/PageSection'
import { EmptyState } from '@/components/ui/EmptyState'
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

// ── Alert Row ─────────────────────────────────────────────────────────────────

// Ligne d'alerte lisible (liste « Toutes les alertes ») — hauteur ~56-64px.
function AlertRow({ alert }: { alert: AlertEntry }) {
  const cfg = KIND_CONFIG[alert.kind]
  const Icon = cfg.Icon

  return (
    <Link
      href={`/chantiers/${alert.projectId}`}
      className={cn(
        'group flex items-center gap-3.5 border-l-[3px] pl-4 pr-4 py-3 rounded-r-xl bg-surface',
        'hover:bg-elevated/40 transition-colors',
        'border border-border/30 dark:border-white/[0.06]',
        cfg.border,
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.iconBg)}>
        <Icon className={cn('h-4 w-4', cfg.iconCls)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={cn(
            'inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border',
            cfg.pill,
          )}>
            {cfg.label}
          </span>
          {alert.projectName && (
            <span className="text-[12px] text-muted-foreground/65 truncate max-w-[160px]">
              {alert.projectName}
            </span>
          )}
          {alert.kind === 'late_task' && alert.daysLate != null && alert.daysLate > 0 && (
            <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-600">
              · {alert.daysLate}j de retard
            </span>
          )}
        </div>
        <p className="text-[14px] font-600 text-foreground truncate leading-snug">{alert.title}</p>
      </div>
      <span className="shrink-0 flex items-center gap-1 text-[12px] font-600 text-muted-foreground/55 group-hover:text-primary transition-colors whitespace-nowrap">
        {cfg.cta} <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

// Carte d'alerte prioritaire riche (grille 3 colonnes) — hauteur ~92px.
function PriorityAlertCard({ alert }: { alert: AlertEntry }) {
  const cfg = KIND_CONFIG[alert.kind]
  const Icon = cfg.Icon

  return (
    <Link
      href={`/chantiers/${alert.projectId}`}
      className={cn(
        'group flex flex-col gap-2 border-l-[3px] p-4 rounded-r-xl bg-surface min-h-[92px]',
        'hover:bg-elevated/40 transition-colors',
        'border border-border/30 dark:border-white/[0.06]',
        cfg.border,
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] font-700 px-2 py-0.5 rounded-full border',
          cfg.pill,
        )}>
          <Icon className={cn('h-3 w-3', cfg.iconCls)} />
          {cfg.label}
        </span>
        {alert.projectName && (
          <span className="text-[12px] text-muted-foreground/65 truncate max-w-[150px]">
            {alert.projectName}
          </span>
        )}
      </div>

      <p className="text-[14px] font-700 text-foreground leading-snug line-clamp-2 flex-1">
        {alert.title}
      </p>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11.5px] text-muted-foreground/70 truncate">
          {alert.kind === 'late_task' && alert.daysLate != null && alert.daysLate > 0
            ? `${alert.daysLate}j de retard`
            : cfg.label}
        </span>
        <span className="shrink-0 flex items-center gap-1 text-[12px] font-600 text-primary/70 group-hover:text-primary group-hover:gap-1.5 transition-all whitespace-nowrap">
          {cfg.cta} <ArrowRight className="h-3 w-3" />
        </span>
      </div>
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
      .slice(0, 3),
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

  const scrollToAllAlerts = () => {
    document.getElementById('toutes-alertes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-7">

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactKpiCard
          icon={AlertOctagon}
          value={kpis.criticalCount}
          label="Alertes critiques"
          tone="red"
          accent={kpis.criticalCount > 0}
          sub={kpis.criticalCount > 0 ? 'Réserves critiques + blocages' : 'Aucune alerte critique'}
        />
        <CompactKpiCard
          icon={Flag}
          value={kpis.openIssuesCount}
          label="Réserves ouvertes"
          tone="orange"
          accent={kpis.openIssuesCount > 0}
          sub={kpis.openIssuesCount > 0 ? 'Non clôturées' : 'Tout est traité'}
        />
        <CompactKpiCard
          icon={Clock}
          value={kpis.lateTasksCount}
          label="Tâches en retard"
          tone="orange"
          accent={kpis.lateTasksCount > 0}
          sub={kpis.lateTasksCount > 0 ? 'Échéance dépassée' : 'Aucun retard'}
        />
        <CompactKpiCard
          icon={Building2}
          value={kpis.atRiskCount}
          label="Chantiers à risque"
          tone="red"
          accent={kpis.atRiskCount > 0}
          sub={kpis.atRiskCount > 0
            ? `Sur ${projects.length} chantier${projects.length > 1 ? 's' : ''}`
            : 'Tous les chantiers sont OK'}
        />
      </div>

      {/* ── À traiter en priorité (3 max + accès à toutes les alertes) ── */}
      <PageSection
        title="À traiter en priorité"
        icon={AlertOctagon}
        iconClassName="text-red-500"
        count={priorityItems.length}
        countTone="red"
        action={alerts.length > priorityItems.length ? (
          <button
            onClick={scrollToAllAlerts}
            className="flex items-center gap-0.5 text-[11px] font-600 text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
          >
            Voir toutes les alertes <ArrowRight className="h-3 w-3" />
          </button>
        ) : undefined}
      >
        {allClear || priorityItems.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2.5 text-center">
            <div className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm font-700 text-foreground">Tout est sous contrôle</p>
            <p className="text-[12px] text-muted-foreground/55">Aucune alerte prioritaire détectée.</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorityItems.map(alert => (
              <PriorityAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </PageSection>

      {/* ── Alertes filtrables ── */}
      <section id="toutes-alertes" className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] scroll-mt-4">
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
            <div className="relative flex-1 min-w-[180px] max-w-[320px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une alerte…"
                className="w-full pl-8 pr-8 h-9 rounded-lg bg-elevated border border-border/40 dark:border-white/[0.08] text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
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
                className="h-9 px-2.5 rounded-lg bg-elevated border border-border/40 dark:border-white/[0.08] text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
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
              <AlertRow key={alert.id} alert={alert} />
            ))}
            {!showAllAlerts && filteredAlerts.length > 15 && (
              <button
                onClick={() => setShowAllAlerts(true)}
                className="mt-1 flex items-center justify-center gap-1 text-[12px] font-600 text-primary hover:text-primary/80 transition-colors py-2"
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
        <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
          Rapports disponibles
        </h2>

        {/* Cartes d'action compactes : icône + titre + description + action à droite */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Rapport global */}
          <div className="bg-surface border border-border/50 dark:border-white/[0.08] rounded-2xl p-4 flex items-center gap-3.5 dashboard-tile">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-700 text-foreground text-[14px]">Rapport global</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                Vision multi-chantiers, KPI et activité récente
              </p>
            </div>
            <Link href="/rapports/global" className="shrink-0">
              <Button size="sm" variant="outline">
                Ouvrir <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Rapport chantier */}
          <div className="bg-surface border border-border/50 dark:border-white/[0.08] rounded-2xl p-4 flex items-center gap-3.5 dashboard-tile">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-700 text-foreground text-[14px]">Rapport chantier</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                Rapport détaillé par chantier et par période
              </p>
            </div>
            <div className="shrink-0">
              <NouveauRapportButton orgId={orgId} userId={userId} projects={projects} />
            </div>
          </div>
        </div>

        {/* Reports history */}
        {reports.length > 0 && (
          <PageSection title="Historique des rapports" icon={FileText} count={reports.length} countTone="muted">
            <div className="divide-y divide-border/20 dark:divide-white/[0.04]">
              {reports.slice(0, 10).map(r => (
                <Link
                  key={r.id}
                  href={`/rapports/${r.id}`}
                  className="group flex items-center gap-3.5 px-5 py-3.5 hover:bg-elevated/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-600 text-foreground truncate">{r.title ?? 'Rapport'}</p>
                    <div className="flex items-center gap-2.5 mt-0.5">
                      {r.project?.name && (
                        <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground/65 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.project.color }} />
                          {r.project.name}
                        </span>
                      )}
                      <span className="text-[11.5px] text-muted-foreground/45">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {r.type && (
                      <span className="text-[11px] font-600 px-2.5 py-1 rounded-lg bg-elevated border border-border/40 text-muted-foreground">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </PageSection>
        )}

        {reports.length === 0 && (
          <div className="border border-dashed border-border/40 rounded-2xl">
            <EmptyState
              icon={BarChart3}
              title="Aucun rapport généré"
              description="Générez un rapport global ou par chantier pour le retrouver ici."
              size="sm"
            />
          </div>
        )}
      </section>

    </div>
  )
}
