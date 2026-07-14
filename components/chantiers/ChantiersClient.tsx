'use client'

import { useState, useMemo } from 'react'
import {
  Search, Plus, Building2, AlertTriangle, Flag,
  ChevronRight, CheckCircle2, Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CompactKpiCard } from '@/components/ui/CompactKpiCard'
import { PageSection } from '@/components/ui/PageSection'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChantierRichCard } from './ChantierRichCard'
import { CanDo } from '@/components/layout/CanDo'
import { cn, formatDateShort } from '@/lib/utils'
import type { Project } from '@/lib/types'

// ── Shared types (imported by page.tsx) ──────────────────────────────────────

export type ProjectStats = {
  totalTasks: number
  doneTasks: number
  lateTasks: number
  blockedTasks: number
  reviewTasks: number
  openIssues: number
  criticalIssues: number
  artisans: { id: string; full_name: string; color: string }[]
  isAtRisk: boolean
}

export type EnrichedProject = Project & { stats: ProjectStats }

// ── Filters ───────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'active' | 'at_risk' | 'completed' | 'with_issues'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',         label: 'Tous' },
  { value: 'active',      label: 'En cours' },
  { value: 'at_risk',     label: 'À risque' },
  { value: 'completed',   label: 'Terminés' },
  { value: 'with_issues', label: 'Avec réserves' },
]

interface Props {
  projects: EnrichedProject[]
  today: string
}

// ── At-risk compact card ──────────────────────────────────────────────────────

function AtRiskCard({ project }: { project: EnrichedProject }) {
  const { stats } = project
  const signals: string[] = []

  if (stats.criticalIssues > 0)
    signals.push(`${stats.criticalIssues} réserve${stats.criticalIssues > 1 ? 's' : ''} critique${stats.criticalIssues > 1 ? 's' : ''}`)
  if (stats.blockedTasks > 0)
    signals.push(`${stats.blockedTasks} tâche${stats.blockedTasks > 1 ? 's' : ''} bloquée${stats.blockedTasks > 1 ? 's' : ''}`)
  if (stats.lateTasks > 0)
    signals.push(`${stats.lateTasks} retard${stats.lateTasks > 1 ? 's' : ''}`)
  if (stats.openIssues > 0 && stats.criticalIssues === 0)
    signals.push(`${stats.openIssues} réserve${stats.openIssues > 1 ? 's' : ''} ouverte${stats.openIssues > 1 ? 's' : ''}`)

  const mainSignal = signals[0] ?? 'Action requise'
  const moreCount  = signals.length - 1

  return (
    <Link
      href={`/chantiers/${project.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-orange-500/20 bg-orange-500/[0.03] hover:bg-orange-500/[0.06] transition-colors min-h-[64px]"
    >
      <div className="w-1.5 h-9 rounded-full shrink-0" style={{ background: project.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-700 text-foreground truncate">{project.name}</p>
        <p className="text-[12px] text-orange-600 dark:text-orange-400 font-600 mt-0.5 truncate">
          {mainSignal}
          {moreCount > 0 && (
            <span className="text-muted-foreground/50 ml-1 font-500">
              +{moreCount} autre{moreCount > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>
      <span className="shrink-0 flex items-center gap-0.5 text-[12px] font-600 text-primary/65 group-hover:text-primary group-hover:gap-1 transition-all">
        Voir <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChantiersClient({ projects, today }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch]  = useState('')

  // KPIs
  const kpis = useMemo(() => {
    const active    = projects.filter(p => p.status === 'active')
    const atRisk    = active.filter(p => p.stats.isAtRisk)
    const totalOpen = projects.reduce((s, p) => s + p.stats.openIssues, 0)
    const totalCrit = projects.reduce((s, p) => s + p.stats.criticalIssues, 0)
    const nextDeadline = active
      .filter(p => p.end_date)
      .sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''))
      .at(0) ?? null
    return {
      activeCount:     active.length,
      atRiskCount:     atRisk.length,
      totalOpenIssues: totalOpen,
      totalCritical:   totalCrit,
      nextDeadline,
    }
  }, [projects])

  // "À surveiller" list
  const atRiskProjects = useMemo(() => {
    const score = (p: EnrichedProject) =>
      p.stats.criticalIssues * 10 + p.stats.blockedTasks * 5 + p.stats.lateTasks
    return projects
      .filter(p => p.stats.isAtRisk && p.status === 'active')
      .sort((a, b) => score(b) - score(a))
      .slice(0, 3)
  }, [projects])

  // Filtered list
  const filtered = useMemo(() => {
    let list = projects
    switch (filter) {
      case 'active':      list = list.filter(p => p.status === 'active'); break
      case 'at_risk':     list = list.filter(p => p.stats.isAtRisk); break
      case 'completed':   list = list.filter(p => p.status === 'completed'); break
      case 'with_issues': list = list.filter(p => p.stats.openIssues > 0); break
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [projects, filter, search])

  // Filter badge counts
  const counts: Record<FilterType, number> = useMemo(() => ({
    all:         projects.length,
    active:      projects.filter(p => p.status === 'active').length,
    at_risk:     projects.filter(p => p.stats.isAtRisk).length,
    completed:   projects.filter(p => p.status === 'completed').length,
    with_issues: projects.filter(p => p.stats.openIssues > 0).length,
  }), [projects])

  const isFiltering   = filter !== 'all' || search.trim() !== ''
  const showSurveiller = atRiskProjects.length > 0 && filter === 'all' && !search.trim()
  const showAllClear   = atRiskProjects.length === 0 && kpis.activeCount > 0 && filter === 'all' && !search.trim()

  // Empty-database state
  if (projects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 py-16">
        <EmptyState
          icon={Building2}
          title="Aucun chantier"
          description="Créez votre premier chantier pour commencer à planifier."
          size="lg"
          action={
            <CanDo action="chantier.create">
              <Link href="/chantiers/nouveau">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Créer un chantier
                </Button>
              </Link>
            </CanDo>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-7">

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactKpiCard
          icon={Building2}
          value={kpis.activeCount}
          label="Chantiers actifs"
          tone="blue"
          sub={`${projects.length} au total`}
        />
        <CompactKpiCard
          icon={AlertTriangle}
          value={kpis.atRiskCount}
          label="À risque"
          tone="orange"
          accent={kpis.atRiskCount > 0}
          sub={kpis.atRiskCount > 0 ? 'Actions requises' : 'Aucun problème'}
        />
        <CompactKpiCard
          icon={Flag}
          value={kpis.totalOpenIssues}
          label="Réserves ouvertes"
          tone={kpis.totalCritical > 0 ? 'red' : 'orange'}
          accent={kpis.totalOpenIssues > 0}
          sub={
            kpis.totalCritical > 0
              ? `dont ${kpis.totalCritical} critique${kpis.totalCritical > 1 ? 's' : ''}`
              : kpis.totalOpenIssues > 0 ? 'À vérifier'
              : null
          }
        />
        <CompactKpiCard
          icon={Calendar}
          value={kpis.nextDeadline ? formatDateShort(kpis.nextDeadline.end_date) : '—'}
          label="Prochaine échéance"
          tone="blue"
          sub={kpis.nextDeadline?.name ?? null}
        />
      </div>

      {/* ── "À surveiller" section (3 max) ── */}
      {showSurveiller && (
        <div data-demo-target="chantiers-a-surveiller">
          <PageSection
            title="Chantiers à surveiller"
            icon={AlertTriangle}
            iconClassName="text-orange-500"
            count={atRiskProjects.length}
            countTone="orange"
            action={kpis.atRiskCount > atRiskProjects.length ? (
              <button
                onClick={() => setFilter('at_risk')}
                className="flex items-center gap-0.5 text-[11px] font-600 text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
              >
                Voir tous ({kpis.atRiskCount}) <ChevronRight className="h-3 w-3" />
              </button>
            ) : undefined}
            bodyClassName="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {atRiskProjects.map(p => <AtRiskCard key={p.id} project={p} />)}
          </PageSection>
        </div>
      )}

      {/* ── All-clear banner ── */}
      {showAllClear && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/[0.06] border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-[13px] font-600 text-green-700 dark:text-green-400">
            Tout est sous contrôle — aucun chantier critique en ce moment.
          </p>
        </div>
      )}

      {/* ── Filters + search ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-600 transition-colors whitespace-nowrap border',
                filter === f.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : f.value === 'at_risk' && counts.at_risk > 0
                    ? 'bg-orange-500/8 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/12'
                    : 'bg-transparent text-muted-foreground border-border/40 hover:text-foreground hover:bg-elevated/50',
              )}
            >
              {f.label}
              {counts[f.value] > 0 && (
                <span className={cn(
                  'text-[10px] font-700 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 leading-none',
                  filter === f.value
                    ? 'bg-white/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {counts[f.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher un chantier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl border border-border/40 bg-surface text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              aria-label="Effacer la recherche"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Card grid or empty state ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ChantierRichCard key={p.id} project={p} today={today} />
          ))}
        </div>
      ) : isFiltering ? (
        <EmptyState
          icon={Building2}
          title="Aucun résultat"
          description="Aucun chantier ne correspond à ce filtre."
          size="lg"
          action={
            <button
              onClick={() => { setFilter('all'); setSearch('') }}
              className="text-sm font-600 text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              Réinitialiser les filtres
            </button>
          }
        />
      ) : (
        <EmptyState
          icon={Building2}
          title="Aucun chantier"
          description="Commencez par créer votre premier chantier."
          size="lg"
          action={
            <CanDo action="chantier.create">
              <Link href="/chantiers/nouveau">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Créer un chantier
                </Button>
              </Link>
            </CanDo>
          }
        />
      )}

    </div>
  )
}
