'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Users, Plus, Search, AlertTriangle, CheckCircle2,
  UserCheck, UserX, Pencil, Archive, X, ChevronRight,
  Building2, Wrench, Briefcase, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TeamSlidePanel, type TeamFormData, type TeamType } from './TeamSlidePanel'
import { EditArtisanModal } from './EditArtisanModal'
import { ArtisanSidePanel, type EnrichedArtisan, type TaskWithProject, type AccountStatus } from './ArtisanSidePanel'
import { cn, getInitials } from '@/lib/utils'
import { mutationClient } from '@/lib/supabase/mutate'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast-context'

// ── Internal types ─────────────────────────────────────────────────────────────

interface ArtisanRow {
  id: string
  org_id: string
  full_name: string | null
  trade: string | null
  color: string | null
  phone: string | null
  email: string | null
  status?: string | null
  is_archived?: boolean
  user_id?: string | null
}

interface TeamMember {
  artisan_id: string | null
  artisan: { id: string; full_name: string | null; trade: string | null; color: string | null } | null
}

interface TeamRow {
  id: string
  name: string | null
  color: string | null
  type: TeamType | null
  project_id: string | null
  description: string | null
  lead_id: string | null
  project: { id: string; name: string } | null
  lead: { id: string; full_name: string | null; trade: string | null } | null
  members: TeamMember[]
}

interface ProjectOption {
  id: string
  name: string
  color: string | null
}

interface Props {
  teams: TeamRow[]
  artisans: ArtisanRow[]
  projects: ProjectOption[]
  orgId: string
  tasks: TaskWithProject[]
  today: string
  canManage?: boolean
  canInvite?: boolean
  currentUserId?: string
  pendingInviteArtisanIds?: string[]
  pendingInviteScopes?: Record<string, { id: string; email: string | null; role: string | null; projectId: string | null; taskIds: string[] }>
  assignmentCounts?: Record<string, { projects: number; tasks: number }>
  accountByArtisan?: Record<string, { role: string | null; email: string | null }>
}

// ── Constants ──────────────────────────────────────────────────────────────────

type ArtisanFilter = 'all' | 'assigned' | 'free' | 'conflict'

const ARTISAN_FILTERS: { value: ArtisanFilter; label: string }[] = [
  { value: 'all',      label: 'Tous' },
  { value: 'assigned', label: 'Affectés' },
  { value: 'free',     label: 'Disponibles' },
  { value: 'conflict', label: 'Conflits' },
]

// Filtre cycle de vie (statut du compte artisan). Vue par défaut : Actifs.
type Lifecycle = 'active' | 'suspended' | 'archived' | 'all'

const LIFECYCLE_FILTERS: { value: Lifecycle; label: string }[] = [
  { value: 'active',    label: 'Actifs' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'archived',  label: 'Archivés' },
  { value: 'all',       label: 'Tous' },
]

const lifecycleOf = (a: { accountStatus?: 'active' | 'suspended' | 'archived' }) => a.accountStatus ?? 'active'

// Charge / disponibilité PLANNING (fenêtre 7 jours à partir d'aujourd'hui) —
// distincte du périmètre de rattachement (chantiers/tâches). Libellés explicites.
const STATUS_CONFIG = {
  free:     { label: 'Libre cette semaine',     cls: 'bg-muted/40 text-muted-foreground/60 border-border/30' },
  assigned: { label: 'Planifié cette semaine',  cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  conflict: { label: 'Surcharge possible',      cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
}

const TYPE_LABEL: Record<TeamType, string> = {
  chantier: 'Chantier', metier: 'Métier', entreprise: 'Entreprise', libre: 'Libre',
}

const TYPE_ICON: Record<TeamType, React.ElementType> = {
  chantier: Building2, metier: Wrench, entreprise: Briefcase, libre: LayoutGrid,
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  value, label, icon: Icon, sub, accent = false,
}: {
  value: React.ReactNode; label: string; icon: React.ElementType; sub?: string | null; accent?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-border/40 dark:border-white/[0.08] px-4 py-3.5 flex items-center gap-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        accent ? 'bg-orange-500/12 text-orange-500' : 'bg-primary/10 text-primary',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[22px] font-800 text-foreground leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
        {sub && (
          <p className={cn('text-[10px] mt-0.5 truncate', accent ? 'text-orange-500/80' : 'text-muted-foreground/55')}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function teamToFormData(t: TeamRow): TeamFormData {
  return {
    id: t.id,
    name: t.name ?? '',
    color: t.color ?? '#2563EB',
    type: t.type ?? 'libre',
    project_id: t.project_id ?? null,
    description: t.description ?? null,
    lead_id: t.lead_id ?? null,
    member_ids: t.members.filter(m => m.artisan_id).map(m => m.artisan_id as string),
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EquipesClient({ teams, artisans, projects, orgId, tasks, today, canManage = false, canInvite = false, currentUserId, pendingInviteArtisanIds = [], pendingInviteScopes = {}, assignmentCounts = {}, accountByArtisan = {} }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const pendingInviteSet = useMemo(() => new Set(pendingInviteArtisanIds), [pendingInviteArtisanIds])

  // Source de vérité des rattachements (badges carte + fiche). Initialisée depuis
  // le serveur, mise à jour de façon optimiste par la fiche (onCountsChanged),
  // puis réconciliée à chaque router.refresh (nouvelles props serveur).
  const [assignCounts, setAssignCounts] = useState(assignmentCounts)
  useEffect(() => { setAssignCounts(assignmentCounts) }, [assignmentCounts])
  const countsFor = (id: string) => assignCounts[id] ?? { projects: 0, tasks: 0 }

  // Tabs
  const [activeTab, setActiveTab] = useState<'artisans' | 'equipes'>('artisans')

  // Filters / search
  const [artisanFilter, setArtisanFilter] = useState<ArtisanFilter>('all')
  const [lifecycle, setLifecycle] = useState<Lifecycle>('active')
  const [search, setSearch] = useState('')

  // Side panels
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(null)
  const [editingArtisanId, setEditingArtisanId] = useState<string | null>(null)
  const [archivingArtisanId, setArchivingArtisanId] = useState<string | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  // Team panel
  const [teamPanelOpen, setTeamPanelOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamFormData | null>(null)

  // ── Derived maps ──────────────────────────────────────────────────────────

  const weekEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [today])

  const projectById = useMemo(() =>
    new Map(projects.map(p => [p.id, p])),
    [projects]
  )

  // team_id → artisan_ids
  const artisansByTeam = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const team of teams) {
      map.set(team.id, team.members.filter(m => m.artisan_id).map(m => m.artisan_id as string))
    }
    return map
  }, [teams])

  // artisan_id → teams[]
  const teamsByArtisan = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }[]>()
    for (const team of teams) {
      for (const m of team.members) {
        if (!m.artisan_id) continue
        if (!map.has(m.artisan_id)) map.set(m.artisan_id, [])
        map.get(m.artisan_id)!.push({ id: team.id, name: team.name ?? '—', color: team.color })
      }
    }
    return map
  }, [teams])

  // artisan_id → week tasks (enriched with projectInfo)
  const weekTasksByArtisan = useMemo(() => {
    type RichTask = TaskWithProject & { projectInfo: { id: string; name: string; color: string } | null }
    const map = new Map<string, RichTask[]>()
    for (const a of artisans) map.set(a.id, [])

    for (const task of tasks) {
      if (!task.end_date) continue
      if (task.end_date < today || task.end_date > weekEnd) continue
      const proj = task.project_id ? projectById.get(task.project_id) : undefined
      const rich: RichTask = {
        ...task,
        projectInfo: proj ? { id: proj.id, name: proj.name, color: proj.color ?? '#6366f1' } : null,
      }
      if (task.assigned_to && map.has(task.assigned_to)) {
        map.get(task.assigned_to)!.push(rich)
      }
      if (task.assigned_team) {
        for (const aid of artisansByTeam.get(task.assigned_team) ?? []) {
          if (map.has(aid)) map.get(aid)!.push(rich)
        }
      }
    }
    return map
  }, [tasks, artisans, today, weekEnd, projectById, artisansByTeam])

  // Affectations « legacy » détectées (planning) : tâches assigned_to, tâches
  // assigned_team via appartenance équipe, et chantier via teams.project_id.
  // Sert à ne pas afficher « Sans chantier/tâche » quand l'artisan est en réalité
  // affecté (mais pas encore rattaché explicitement) → évite la contradiction.
  const legacyByArtisan = useMemo(() => {
    const map = new Map<string, { taskIds: Set<string>; projectIds: Set<string> }>()
    const ensure = (id: string) => {
      let e = map.get(id)
      if (!e) { e = { taskIds: new Set(), projectIds: new Set() }; map.set(id, e) }
      return e
    }
    for (const task of tasks) {
      if (task.assigned_to) {
        const e = ensure(task.assigned_to)
        e.taskIds.add(task.id)
        if (task.project_id) e.projectIds.add(task.project_id)
      }
      if (task.assigned_team) {
        for (const aid of artisansByTeam.get(task.assigned_team) ?? []) {
          const e = ensure(aid)
          e.taskIds.add(task.id)
          if (task.project_id) e.projectIds.add(task.project_id)
        }
      }
    }
    for (const team of teams) {
      if (!team.project_id) continue
      for (const m of team.members) {
        if (m.artisan_id) ensure(m.artisan_id).projectIds.add(team.project_id)
      }
    }
    return map
  }, [tasks, artisansByTeam, teams])

  // Enriched artisans
  const enrichedArtisans = useMemo((): EnrichedArtisan[] =>
    artisans.map(a => {
      const weekTasks = weekTasksByArtisan.get(a.id) ?? []
      const status: EnrichedArtisan['status'] =
        weekTasks.length > 1 ? 'conflict' :
        weekTasks.length === 1 ? 'assigned' : 'free'
      const projectMap = new Map(weekTasks.filter(t => t.projectInfo).map(t => [t.projectInfo!.id, t.projectInfo!]))
      return {
        ...a,
        status,
        accountStatus: ((a.status as AccountStatus) ?? 'active'),
        hasAccount: !!a.user_id,
        accountRole: accountByArtisan[a.id]?.role ?? null,
        accountEmail: accountByArtisan[a.id]?.email ?? null,
        hasPendingInvite: pendingInviteSet.has(a.id),
        weekTasks,
        currentProjects: Array.from(projectMap.values()),
        artisanTeams: teamsByArtisan.get(a.id) ?? [],
      }
    }),
    [artisans, weekTasksByArtisan, teamsByArtisan, pendingInviteSet, accountByArtisan]
  )

  // Sous-ensembles par cycle de vie. Les métriques (KPI/alertes) ne portent que
  // sur les artisans ACTIFS ; suspendus/archivés restent listables via le filtre.
  const activeArtisans = useMemo(() => enrichedArtisans.filter(a => lifecycleOf(a) === 'active'), [enrichedArtisans])
  const lifecycleArtisans = useMemo(
    () => lifecycle === 'all' ? enrichedArtisans : enrichedArtisans.filter(a => lifecycleOf(a) === lifecycle),
    [enrichedArtisans, lifecycle],
  )
  const lifecycleCounts = useMemo(() => ({
    active:    enrichedArtisans.filter(a => lifecycleOf(a) === 'active').length,
    suspended: enrichedArtisans.filter(a => lifecycleOf(a) === 'suspended').length,
    archived:  enrichedArtisans.filter(a => lifecycleOf(a) === 'archived').length,
    all:       enrichedArtisans.length,
  }), [enrichedArtisans])

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    assigned:    activeArtisans.filter(a => a.status === 'assigned').length,
    free:        activeArtisans.filter(a => a.status === 'free').length,
    conflicts:   activeArtisans.filter(a => a.status === 'conflict').length,
    activeTeams: teams.filter(t => t.members.length > 0).length,
  }), [activeArtisans, teams])

  // ── Alerts ────────────────────────────────────────────────────────────────

  type Alert =
    | { type: 'conflict';   artisan: EnrichedArtisan }
    | { type: 'empty_team'; team: TeamRow }
    | { type: 'blocked';    task: TaskWithProject & { projectInfo: { id: string; name: string; color: string } | null } }

  const alerts = useMemo((): Alert[] => {
    const result: Alert[] = []
    for (const a of activeArtisans) {
      if (a.status === 'conflict') result.push({ type: 'conflict', artisan: a })
    }
    for (const t of teams) {
      if (t.members.length === 0) result.push({ type: 'empty_team', team: t })
    }
    for (const task of tasks) {
      if (task.status === 'blocked' && !task.assigned_to && !task.assigned_team) {
        const proj = task.project_id ? projectById.get(task.project_id) : undefined
        result.push({
          type: 'blocked',
          task: {
            ...task,
            projectInfo: proj ? { id: proj.id, name: proj.name, color: proj.color ?? '#6366f1' } : null,
          },
        })
      }
    }
    return result.slice(0, 6)
  }, [activeArtisans, teams, tasks, projectById])

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredArtisans = useMemo(() => {
    let list = lifecycleArtisans
    if (artisanFilter !== 'all') list = list.filter(a => a.status === artisanFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(a =>
        (a.full_name ?? '').toLowerCase().includes(q) ||
        (a.trade ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [lifecycleArtisans, artisanFilter, search])

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams
    const q = search.trim().toLowerCase()
    return teams.filter(t =>
      (t.name ?? '').toLowerCase().includes(q) ||
      (t.project?.name ?? '').toLowerCase().includes(q)
    )
  }, [teams, search])

  const filterCounts: Record<ArtisanFilter, number> = useMemo(() => ({
    all:      lifecycleArtisans.length,
    assigned: lifecycleArtisans.filter(a => a.status === 'assigned').length,
    free:     lifecycleArtisans.filter(a => a.status === 'free').length,
    conflict: lifecycleArtisans.filter(a => a.status === 'conflict').length,
  }), [lifecycleArtisans])

  // ── Selected artisan ──────────────────────────────────────────────────────

  const selectedArtisan = selectedArtisanId
    ? enrichedArtisans.find(a => a.id === selectedArtisanId) ?? null
    : null

  const editingArtisan = editingArtisanId
    ? artisans.find(a => a.id === editingArtisanId) ?? null
    : null

  const archivingArtisan = archivingArtisanId
    ? artisans.find(a => a.id === archivingArtisanId) ?? null
    : null

  // ── Archive handler ───────────────────────────────────────────────────────

  const handleArchive = async () => {
    if (!archivingArtisan) return
    setArchiveLoading(true)
    const { error: err } = await mutationClient()
      .from('artisans')
      // LOT 41B — aligne le statut lifecycle sur is_archived (source cible = status).
      .update({ is_archived: true, status: 'archived' })
      .eq('id', archivingArtisan.id)
      .eq('org_id', archivingArtisan.org_id)
    setArchiveLoading(false)
    if (err) { toast(err.message, 'error'); return }
    toast('Artisan archivé')
    setArchivingArtisanId(null)
    setSelectedArtisanId(null)
    router.refresh()
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (artisans.length === 0 && teams.length === 0) {
    return (
      <div className="px-6 lg:px-10 py-6">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center">
            <Users className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-700 text-foreground mb-1">Aucune équipe ni artisan</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Ajoutez vos premiers artisans pour commencer à planifier les affectations.
            </p>
            <Link href="/equipes/nouveau-artisan">
              <Button size="sm"><Plus className="h-4 w-4" />Ajouter un artisan</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="px-6 lg:px-10 py-6 flex flex-col gap-6">

        {/* ── KPI bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            icon={UserCheck}
            value={kpis.assigned}
            label="Affectés cette semaine"
            sub={activeArtisans.length > 0 ? `sur ${activeArtisans.length} artisan${activeArtisans.length > 1 ? 's' : ''} actif${activeArtisans.length > 1 ? 's' : ''}` : null}
          />
          <KpiTile
            icon={UserX}
            value={kpis.free}
            label="Disponibles"
            sub={kpis.free > 0 ? 'Aucune tâche cette semaine' : kpis.conflicts === 0 ? 'Tout le monde est affecté' : null}
          />
          <KpiTile
            icon={AlertTriangle}
            value={kpis.conflicts}
            label="Conflits"
            accent={kpis.conflicts > 0}
            sub={kpis.conflicts > 0 ? 'Multi-affectations à vérifier' : 'Aucun conflit détecté'}
          />
          <KpiTile
            icon={Users}
            value={kpis.activeTeams}
            label="Équipes actives"
            sub={`${teams.length} équipe${teams.length !== 1 ? 's' : ''} au total`}
          />
        </div>

        {/* ── À surveiller ── */}
        {alerts.length > 0 ? (
          <section className="bg-surface rounded-2xl border border-border/40 dark:border-white/[0.08] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
            <div className="px-5 py-3 border-b border-border/25 flex items-center gap-2.5 bg-surface">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground flex-1">
                À surveiller
              </h2>
              <span className="min-w-[20px] h-5 rounded-full bg-orange-500/12 text-orange-600 dark:text-orange-400 text-[10px] font-700 flex items-center justify-center px-1.5 leading-none border border-orange-500/20">
                {alerts.length}
              </span>
            </div>
            <div className={cn(
              'p-4 grid gap-2',
              alerts.length === 1 ? 'grid-cols-1 max-w-[520px]' : 'grid-cols-1 sm:grid-cols-2',
            )}>
              {alerts.map((alert, i) => (
                <div key={i}>
                  {alert.type === 'conflict' && (
                    <button
                      onClick={() => setSelectedArtisanId(alert.artisan.id)}
                      className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.03] hover:bg-orange-500/[0.06] transition-colors text-left"
                    >
                      <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: alert.artisan.color ?? '#f97316' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-700 text-foreground truncate">{alert.artisan.full_name ?? 'Artisan'}</p>
                        <p className="text-[11px] text-orange-600 dark:text-orange-400 font-600 mt-0.5">
                          {alert.artisan.weekTasks.length} tâches simultanées
                        </p>
                      </div>
                      <span className="flex items-center gap-0.5 text-[11px] font-600 text-primary/65 group-hover:text-primary shrink-0">
                        Voir <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )}
                  {alert.type === 'empty_team' && (
                    <button
                      onClick={() => { setEditingTeam(teamToFormData(alert.team)); setTeamPanelOpen(true) }}
                      className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="w-1.5 h-8 rounded-full bg-muted-foreground/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-700 text-foreground truncate">{alert.team.name ?? 'Équipe'}</p>
                        <p className="text-[11px] text-muted-foreground/70 font-600 mt-0.5">Équipe sans membre</p>
                      </div>
                      <span className="flex items-center gap-0.5 text-[11px] font-600 text-primary/65 group-hover:text-primary shrink-0">
                        Compléter <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )}
                  {alert.type === 'blocked' && (
                    <Link
                      href={`/chantiers/${alert.task.project_id}`}
                      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.03] hover:bg-red-500/[0.06] transition-colors"
                    >
                      <div className="w-1.5 h-8 rounded-full bg-red-500/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-700 text-foreground truncate">{alert.task.title}</p>
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-600 mt-0.5">Tâche bloquée sans intervenant</p>
                      </div>
                      <span className="flex items-center gap-0.5 text-[11px] font-600 text-primary/65 group-hover:text-primary shrink-0">
                        Voir <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : artisans.length > 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/[0.06] border border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-[13px] font-600 text-green-700 dark:text-green-400">
              Tout est sous contrôle — aucun conflit d'affectation détecté.
            </p>
          </div>
        ) : null}

        {/* ── Tabs + search ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tab toggle */}
          <div className="flex items-center bg-elevated/50 border border-border/40 rounded-xl p-1 gap-1 shrink-0">
            {(['artisans', 'equipes'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSearch(''); setArtisanFilter('all'); setLifecycle('active') }}
                className={cn(
                  'h-7 px-3.5 rounded-lg text-[12px] font-600 transition-colors whitespace-nowrap',
                  activeTab === tab
                    ? 'bg-surface text-foreground shadow-sm border border-border/30'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'artisans' ? `Artisans (${lifecycleCounts.active})` : `Équipes (${teams.length})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45 pointer-events-none" />
            <input
              type="text"
              placeholder={activeTab === 'artisans' ? 'Rechercher un artisan…' : 'Rechercher une équipe…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl border border-border/40 bg-surface text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                aria-label="Effacer"
              >
                ×
              </button>
            )}
          </div>

          {/* Artisan filter pills */}
          {activeTab === 'artisans' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {ARTISAN_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setArtisanFilter(f.value)}
                  className={cn(
                    'flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-600 transition-colors whitespace-nowrap border',
                    artisanFilter === f.value
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : f.value === 'conflict' && filterCounts.conflict > 0
                        ? 'bg-orange-500/8 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/12'
                        : 'bg-transparent text-muted-foreground border-border/40 hover:text-foreground hover:bg-elevated/50',
                  )}
                >
                  {f.label}
                  {filterCounts[f.value] > 0 && (
                    <span className={cn(
                      'text-[10px] font-700 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 leading-none',
                      artisanFilter === f.value ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {filterCounts[f.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Nouvelle équipe button (équipes tab) */}
          {activeTab === 'equipes' && canManage && (
            <button
              onClick={() => { setEditingTeam(null); setTeamPanelOpen(true) }}
              className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-600 bg-transparent text-muted-foreground border border-border/40 hover:text-foreground hover:bg-elevated/50 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle équipe
            </button>
          )}
        </div>

        {/* ── Lifecycle segmented control (artisans tab) ── */}
        {activeTab === 'artisans' && (
          <div className="flex items-center gap-1 bg-elevated/50 border border-border/40 rounded-xl p-1 w-fit">
            {LIFECYCLE_FILTERS.map(l => (
              <button
                key={l.value}
                onClick={() => setLifecycle(l.value)}
                className={cn(
                  'flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-600 transition-colors whitespace-nowrap',
                  lifecycle === l.value
                    ? 'bg-surface text-foreground shadow-sm border border-border/30'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {l.label}
                <span className={cn(
                  'text-[10px] font-700 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 leading-none',
                  lifecycle === l.value ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground/70',
                )}>
                  {lifecycleCounts[l.value]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Artisans tab ── */}
        {activeTab === 'artisans' && (
          filteredArtisans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredArtisans.map(artisan => {
                const config = STATUS_CONFIG[artisan.status]
                const initials = getInitials(artisan.full_name)
                const ac = countsFor(artisan.id)
                const legacy = legacyByArtisan.get(artisan.id)
                const hasLegacyProject = (legacy?.projectIds.size ?? 0) > 0
                const hasLegacyTask    = (legacy?.taskIds.size ?? 0) > 0
                const isActive = artisan.accountStatus === 'active'
                // « Sans chantier/tâche » seulement si AUCUN rattachement explicite
                // ET aucune affectation legacy (sinon on ne ment pas : « À confirmer »).
                const showNoProject = canManage && isActive && ac.projects === 0 && !hasLegacyProject
                const showNoTask    = canManage && isActive && ac.tasks === 0 && !hasLegacyTask
                const showToConfirm = canManage && isActive && ac.projects === 0 && ac.tasks === 0 && (hasLegacyProject || hasLegacyTask)
                const mainProject = artisan.currentProjects[0]
                const teamLabel = artisan.artisanTeams.length > 0
                  ? artisan.artisanTeams.slice(0, 2).map(t => t.name).join(', ') +
                    (artisan.artisanTeams.length > 2 ? ` +${artisan.artisanTeams.length - 2}` : '')
                  : null
                return (
                  <div
                    key={artisan.id}
                    onClick={() => setSelectedArtisanId(artisan.id)}
                    className={cn(
                      'dashboard-tile bg-surface rounded-2xl border overflow-hidden cursor-pointer group',
                      'transition-[box-shadow,border-color] duration-200',
                      'shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
                      artisan.status === 'conflict'
                        ? 'border-orange-500/30 dark:border-orange-500/20 hover:border-orange-500/50 dark:hover:border-orange-500/35'
                        : 'border-border/50 dark:border-white/[0.10] hover:border-border/80 dark:hover:border-white/[0.18]',
                    )}
                  >
                    {/* Color strip */}
                    <div className="h-[3px]" style={{ background: artisan.color ?? '#6366f1' }} />

                    <div className="px-4 pt-3.5 pb-3 flex flex-col gap-3">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-700 shrink-0"
                          style={{ background: artisan.color ?? '#6366f1' }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-700 text-[14px] text-foreground truncate group-hover:text-primary transition-colors">
                            {artisan.full_name ?? 'Artisan'}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                            {artisan.trade ?? 'Métier non renseigné'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {artisan.accountStatus === 'suspended' && (
                            <span className="text-[9.5px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                              Suspendu
                            </span>
                          )}
                          {artisan.accountStatus === 'archived' && (
                            <span className="text-[9.5px] font-700 px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground border-border/40">
                              Archivé
                            </span>
                          )}
                          {showNoProject && (
                            <span className="text-[9.5px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                              Sans chantier
                            </span>
                          )}
                          {showNoTask && (
                            <span className="text-[9.5px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                              Sans tâche
                            </span>
                          )}
                          {showToConfirm && (
                            <span className="text-[9.5px] font-700 px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" title="Affecté via le planning — rattachement explicite à confirmer">
                              À confirmer
                            </span>
                          )}
                          {/* Badge de charge (Affecté/Multi-affecté/Disponible) masqué en état
                              « À confirmer » pour ne pas contredire ce dernier. */}
                          {!showToConfirm && (
                            <span className={cn(
                              'text-[9.5px] font-700 px-2 py-0.5 rounded-full border',
                              config.cls,
                            )}>
                              {config.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rattachements (même source que la fiche : assignCounts).
                          Pour les rôles internes ; sinon repli sur le planning (assigned_to). */}
                      <div className="flex items-center gap-2 min-w-0">
                        {canManage ? (
                          (ac.projects > 0 || ac.tasks > 0) ? (
                            <span className="text-[11.5px] text-foreground/75 font-500 truncate flex-1">
                              <span className="text-muted-foreground/70">Périmètre : </span>
                              {ac.projects} chantier{ac.projects > 1 ? 's' : ''}
                              {' · '}
                              {ac.tasks} tâche{ac.tasks > 1 ? 's' : ''}
                            </span>
                          ) : (hasLegacyProject || hasLegacyTask) ? (
                            <span className="text-[11.5px] text-blue-600/90 dark:text-blue-400/90 font-500 truncate flex-1">
                              Affecté via le planning — à confirmer
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/45 italic flex-1">Aucun périmètre défini</span>
                          )
                        ) : mainProject ? (
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: mainProject.color }} />
                            <span className="text-[11.5px] text-foreground/75 font-500 truncate">{mainProject.name}</span>
                            {artisan.currentProjects.length > 1 && (
                              <span className="text-[10px] text-orange-500 font-600 shrink-0">
                                +{artisan.currentProjects.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/45 italic flex-1">Aucune tâche planifiée</span>
                        )}
                      </div>

                      {/* Footer: teams + actions */}
                      <div className="flex items-center justify-between border-t border-border/15 pt-2.5 min-w-0">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {teamLabel ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <Users className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                              <span className="text-[10.5px] text-muted-foreground/55 truncate">{teamLabel}</span>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-muted-foreground/30 italic">Sans équipe</span>
                          )}
                        </div>
                        {canManage && (
                          <div
                            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setEditingArtisanId(artisan.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                              title="Modifier"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            {artisan.accountStatus !== 'archived' && (
                              <button
                                onClick={() => setArchivingArtisanId(artisan.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-colors"
                                title="Archiver"
                              >
                                <Archive className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-xl bg-elevated flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <div className="text-center">
                <h3 className="font-700 text-foreground mb-1">Aucun artisan trouvé</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {lifecycle === 'archived'
                    ? 'Aucun artisan archivé.'
                    : lifecycle === 'suspended'
                      ? 'Aucun artisan suspendu.'
                      : 'Aucun artisan ne correspond à ce filtre.'}
                </p>
                <button
                  onClick={() => { setArtisanFilter('all'); setSearch(''); setLifecycle('active') }}
                  className="text-sm font-600 text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          )
        )}

        {/* ── Équipes tab ── */}
        {activeTab === 'equipes' && (
          filteredTeams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeams.map(team => {
                const teamColor = team.color ?? '#94a3b8'
                const teamType = team.type ?? 'libre'
                const TypeIcon = TYPE_ICON[teamType]
                const isEmpty = team.members.length === 0
                const hasProject = !!team.project
                const teamStatus = isEmpty ? 'À compléter' : hasProject ? 'Active' : 'Sans chantier'
                const teamStatusCls = isEmpty
                  ? 'bg-orange-500/8 text-orange-600 dark:text-orange-400 border-orange-500/20'
                  : hasProject
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                    : 'bg-muted/40 text-muted-foreground/60 border-border/30'
                const teamTaskCount = tasks.filter(t =>
                  t.assigned_team === team.id && t.status !== 'done' && t.status !== 'validated'
                ).length
                return (
                  <div
                    key={team.id}
                    className={cn(
                      'dashboard-tile bg-surface rounded-2xl border overflow-hidden group',
                      'transition-[box-shadow,border-color] duration-200',
                      'shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
                      isEmpty
                        ? 'border-orange-500/20 dark:border-orange-500/15 hover:border-orange-500/40 dark:hover:border-orange-500/30'
                        : 'border-border/50 dark:border-white/[0.10] hover:border-border/80 dark:hover:border-white/[0.18]',
                    )}
                  >
                    {/* Color strip */}
                    <div className="h-[3px]" style={{ background: teamColor }} />

                    <div className="px-4 pt-3.5 pb-3 flex flex-col gap-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: teamColor + '22', border: `2px solid ${teamColor}` }}
                          >
                            <Users className="h-5 w-5" style={{ color: teamColor }} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-700 text-[14px] text-foreground truncate group-hover:text-primary transition-colors">
                              {team.name ?? 'Équipe'}
                            </h3>
                            {team.lead && (
                              <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                                Chef : {team.lead.full_name ?? '—'}
                              </p>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <button
                            onClick={() => { setEditingTeam(teamToFormData(team)); setTeamPanelOpen(true) }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-600 bg-primary/8 text-primary border border-primary/15">
                          <TypeIcon className="h-2.5 w-2.5" />
                          {TYPE_LABEL[teamType]}
                        </span>
                        <span className={cn('inline-flex items-center text-[10.5px] font-600 px-2 py-0.5 rounded-full border', teamStatusCls)}>
                          {teamStatus}
                        </span>
                        {teamTaskCount > 0 && (
                          <span className="inline-flex items-center text-[10.5px] font-500 px-2 py-0.5 rounded-full border border-border/30 bg-elevated text-muted-foreground">
                            {teamTaskCount} tâche{teamTaskCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Project link */}
                      {team.project && (
                        <Link
                          href={`/chantiers/${team.project.id}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-[11.5px] text-foreground/70 hover:text-primary transition-colors truncate"
                        >
                          <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                          <span className="truncate font-500">{team.project.name}</span>
                        </Link>
                      )}

                      {/* Members */}
                      <div className="border-t border-border/15 pt-2.5">
                        <p className="text-[10.5px] text-muted-foreground/55 mb-1.5">
                          {team.members.length} membre{team.members.length !== 1 ? 's' : ''}
                        </p>
                        {team.members.length > 0 ? (
                          <div className="flex -space-x-1.5">
                            {team.members.slice(0, 6).map((m, i) => {
                              const mColor = m.artisan?.color ?? '#94a3b8'
                              const mName = m.artisan?.full_name ?? 'Artisan'
                              return (
                                <div
                                  key={m.artisan_id ?? i}
                                  className="w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-white text-[9px] font-700 shrink-0"
                                  style={{ background: mColor, zIndex: 6 - i }}
                                  title={mName}
                                >
                                  {getInitials(mName)}
                                </div>
                              )
                            })}
                            {team.members.length > 6 && (
                              <div
                                className="w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-[9px] font-700 bg-elevated text-muted-foreground shrink-0"
                                style={{ zIndex: 0 }}
                              >
                                +{team.members.length - 6}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/40 italic">
                            Aucun membre — cliquez Modifier pour ajouter
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : canManage ? (
            <div
              onClick={() => { setEditingTeam(null); setTeamPanelOpen(true) }}
              className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                <Users className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-600 text-foreground">Créer la première équipe</p>
                <p className="text-xs text-muted-foreground mt-0.5">Regroupez vos artisans par chantier, métier ou entreprise</p>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-2 text-center">
              <Users className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aucune équipe pour le moment.</p>
            </div>
          )
        )}

      </div>

      {/* ── Side panels & modals ── */}

      {selectedArtisan && (
        <ArtisanSidePanel
          artisan={selectedArtisan}
          onClose={() => setSelectedArtisanId(null)}
          onEdit={() => { setEditingArtisanId(selectedArtisan.id); setSelectedArtisanId(null) }}
          orgId={orgId}
          canManage={canManage}
          canInvite={canInvite}
          currentUserId={currentUserId}
          projects={projects}
          tasks={tasks}
          onChanged={() => router.refresh()}
          onCountsChanged={(id, projectsCount, tasksCount) =>
            setAssignCounts(prev => ({ ...prev, [id]: { projects: projectsCount, tasks: tasksCount } }))}
          pendingScope={pendingInviteScopes[selectedArtisan.id]}
        />
      )}

      {editingArtisan && (
        <EditArtisanModal
          artisan={editingArtisan}
          onClose={() => setEditingArtisanId(null)}
        />
      )}

      {archivingArtisan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-orange-500" />
                <h2 className="font-700 text-foreground">Archiver cet artisan ?</h2>
              </div>
              <button onClick={() => setArchivingArtisanId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-600 text-foreground">{archivingArtisan.full_name}</span> ne sera plus affiché dans la liste ni dans les assignations de tâches.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleArchive}
                  disabled={archiveLoading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-0"
                >
                  {archiveLoading ? 'Archivage…' : 'Archiver'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setArchivingArtisanId(null)} disabled={archiveLoading}>
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {teamPanelOpen && (
        <TeamSlidePanel
          team={editingTeam}
          artisans={artisans}
          projects={projects}
          orgId={orgId}
          onClose={() => { setTeamPanelOpen(false); setEditingTeam(null) }}
        />
      )}
    </>
  )
}
