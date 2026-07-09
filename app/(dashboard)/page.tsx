import { createClient } from '@/lib/supabase/server'
import { TodayFocus } from '@/components/dashboard/TodayFocus'
import { WeekByDay } from '@/components/dashboard/WeekByDay'
import { TeamAssignments } from '@/components/dashboard/TeamAssignments'
import { PhotoValidations } from '@/components/dashboard/PhotoValidations'
import { MessagesTeam } from '@/components/dashboard/MessagesTeam'
import { KpiChip } from '@/components/dashboard/KpiCompact'
import { Building2, Check, Building, Clock, AlertTriangle, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import type { Task } from '@/lib/types'

const PHOTO_TTL = 3600

// ── helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(today: string): { weekStart: string; weekEnd: string } {
  const d = new Date(today + 'T12:00:00')
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const sat = new Date(mon)
  sat.setDate(mon.getDate() + 5)
  return {
    weekStart: mon.toISOString().split('T')[0],
    weekEnd: sat.toISOString().split('T')[0],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id, full_name, role')
    .eq('id', user.id)
    .single()
  const profile = profileData as unknown as { org_id: string | null; full_name: string | null; role: string | null } | null
  const orgId = profile?.org_id ?? ''
  // LOT 39 — rôles autorisés à valider/refuser une photo (aligné sur la RPC review_photo).
  const canReviewPhotos = ['owner', 'admin', 'manager', 'site_supervisor'].includes(profile?.role ?? '')

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, name, color, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(20)

  const projects = (projectsData ?? []) as unknown as {
    id: string; name: string; color: string; status: string
  }[]
  const activeProjectIds = projects.map(p => p.id)

  const today = new Date().toISOString().split('T')[0]
  const { weekStart, weekEnd } = getWeekBounds(today)

  // ── Parallel data fetch ──────────────────────────────────────────────────────
  const [
    kpiTasks,
    kpiIssues,
    kpiCriticalIssues,
    kpiArtisans,
    kpiTeamMembers,
    kpiMessages,
    kpiPhotosRaw,
    kpiTeams,
  ] = await Promise.all([
    // All non-done tasks (broad: for week planning + artisan assignments)
    activeProjectIds.length > 0
      ? supabase
          .from('tasks')
          // LOT 27D — sélection complète (+ ids dans les jointures) pour alimenter
          // correctement TaskSidePanel en édition depuis le dashboard (priority,
          // description, etc. — sinon la sauvegarde les écraserait).
          .select(
            '*,' +
            'assignee:artisans!assigned_to(id, full_name, color), team:teams!assigned_team(id, name, color), project:projects!project_id(id, name, color)',
          )
          .in('project_id', activeProjectIds)
          .not('status', 'in', '(done,validated)')
          .order('end_date', { ascending: true, nullsFirst: false })
          .limit(80)
      : Promise.resolve({ data: [], error: null } as any),

    // Open issues count
    activeProjectIds.length > 0
      ? supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .in('project_id', activeProjectIds)
          .eq('status', 'open')
      : Promise.resolve({ count: 0, data: null, error: null } as any),

    // Critical/high issues for TodayFocus
    activeProjectIds.length > 0
      ? supabase
          .from('issues')
          .select('id, title, priority, project_id, project:projects(name)')
          .in('project_id', activeProjectIds)
          .eq('status', 'open')
          .in('priority', ['high', 'critical'])
          .order('priority', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null } as any),

    // Artisans for team tile
    supabase
      .from('artisans')
      .select('id, full_name, trade, color')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .order('full_name')
      .limit(12),

    // Team members for resolving team-based assignments (RLS filters by org via teams)
    supabase
      .from('team_members')
      .select('team_id, artisan_id'),

    // Recent messages
    activeProjectIds.length > 0
      ? supabase
          .from('messages')
          .select(
            'id, content, type, created_at, project_id,' +
            'project:projects(name), sender:profiles!sender_id(full_name)',
          )
          .in('project_id', activeProjectIds)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null } as any),

    // Photos with storage_path + issue status
    activeProjectIds.length > 0
      ? supabase
          .from('photos')
          .select(
            'id, url, thumbnail_url, caption, storage_path, project_id, issue_id, task_id, taken_by, created_at,' +
            'validation_status, reviewed_at, review_comment,' +
            'project:projects(name), issue:issues(status), uploader:profiles!taken_by(full_name),' +
            'task:tasks!task_id(id, title), reviewer:profiles!reviewed_by(full_name)',
          )
          .in('project_id', activeProjectIds)
          // LOT 40 — défense en profondeur : filtre org_id EXPLICITE en plus du
          // filtre project_id et de la RLS (isolation multi-tenant garantie même
          // en cas de régression RLS).
          .eq('org_id', orgId)
          // LOT 39 — la tuile « Photos & validations » ne montre que les photos à valider.
          .eq('validation_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [], error: null } as any),

    // LOT 27D — teams for the dashboard sidewindow assignment editor
    supabase
      .from('teams')
      .select('id, name, color, type, members:team_members(artisan_id)')
      .eq('org_id', orgId)
      .order('name'),
  ])

  // ── Signed URLs for photos ────────────────────────────────────────────────────
  const rawPhotos = (kpiPhotosRaw.data ?? []) as any[]
  const photoPaths = rawPhotos
    .map((p, i) => ({ path: p.storage_path as string | null, origIndex: i }))
    .filter(x => x.path)

  const photoSignedResult =
    photoPaths.length > 0
      ? await supabase.storage
          .from('photos')
          .createSignedUrls(photoPaths.map(x => x.path!), PHOTO_TTL)
      : { data: null }

  const photoSignedMap = new Map(photoPaths.map((x, si) => [x.origIndex, si]))
  const photos = rawPhotos.map((p, i) => {
    const si = photoSignedMap.get(i)
    const signedUrl = si !== undefined ? (photoSignedResult.data?.[si]?.signedUrl ?? null) : null
    return {
      id: p.id as string,
      url: (signedUrl ?? (p.url as string | null)) as string | null,
      thumbnail_url: p.thumbnail_url as string | null,
      caption: p.caption as string | null,
      project_id: p.project_id as string,
      issue_status: (p.issue as { status: string } | null)?.status ?? null,
      project: (p.project as { name: string } | null) ?? null,
      author: (p.uploader as { full_name: string | null } | null)?.full_name ?? null,
      created_at: (p.created_at as string | null) ?? null,
      validation_status: (p.validation_status as string | null) ?? 'pending',
      task: (p.task as { id: string; title: string } | null) ?? null,
      reviewer: (p.reviewer as { full_name: string | null } | null)?.full_name ?? null,
      reviewed_at: (p.reviewed_at as string | null) ?? null,
      review_comment: (p.review_comment as string | null) ?? null,
    }
  })

  // ── Typed data ──────────────────────────────────────────────────────────────
  type RichTask = Task & {
    project_id: string
    start_date: string | null
    end_date: string | null
    assigned_to: string | null
    assigned_team: string | null
    project?: { id: string; name: string; color: string } | null
    assignee?: { id: string; full_name: string | null; color: string | null } | null
    team?: { id: string; name: string; color: string | null } | null
  }

  const tasks = (kpiTasks.data ?? []) as unknown as RichTask[]
  const issuesOpen = kpiIssues.count ?? 0
  const criticalIssues = (kpiCriticalIssues.data ?? []) as unknown as {
    id: string; title: string; priority: string; project_id: string; project?: { name: string } | null
  }[]
  const artisans = (kpiArtisans.data ?? []) as unknown as {
    id: string; full_name: string; trade: string; color: string
  }[]
  const teamMembers = (kpiTeamMembers.data ?? []) as unknown as {
    team_id: string; artisan_id: string
  }[]
  // LOT 27D — teams shaped for TaskSidePanel (dashboard sidewindow assignment editor)
  const teams = ((kpiTeams.data ?? []) as unknown as Array<{
    id: string; name: string; color: string | null; type: string | null
    members: { artisan_id: string }[]
  }>).map(t => ({ id: t.id, name: t.name, color: t.color, type: t.type, memberCount: t.members?.length ?? 0 }))
  const messages = (kpiMessages.data ?? []) as unknown as {
    id: string; content: string; type: string; created_at: string; project_id: string | null;
    project?: { name: string } | null; sender?: { full_name: string | null } | null
  }[]

  // ── Derived ──────────────────────────────────────────────────────────────────

  // Late + blocked for TodayFocus
  const lateTasks = tasks.filter(t => t.end_date && t.end_date < today)
  const blockedTasks = tasks.filter(t => t.status === 'blocked')

  // Week tasks: all tasks overlapping the current calendar week (Mon-Sat)
  const weekTasks = tasks.filter(t => {
    if (!t.end_date) return t.status === 'in_progress' // in-progress with no end date
    const start = t.start_date ?? t.end_date
    return start <= weekEnd && t.end_date >= weekStart
  })

  const priorityCount = lateTasks.length + blockedTasks.length + criticalIssues.length

  // ── Greeting ──────────────────────────────────────────────────────────────────
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }
  const firstName = profile?.full_name?.split(' ')[0] ?? 'vous'
  const isEmpty = projects.length === 0

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-10 pt-6 pb-4 border-b border-border/20 dark:border-white/[0.05]">
        <div className="mx-auto w-full max-w-[1440px] flex flex-wrap items-center gap-4 justify-between">

          {/* Greeting */}
          <div className="shrink-0">
            <h1 className="text-[1.6rem] font-extrabold text-foreground tracking-tight leading-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              <span className="capitalize">{dateLabel}</span>
              {priorityCount > 0 && (
                <span className="text-muted-foreground/55">
                  {' '}·{' '}
                  <span className="text-foreground/65 font-500">
                    {priorityCount} action{priorityCount > 1 ? 's' : ''} prioritaire{priorityCount > 1 ? 's' : ''}
                  </span>
                </span>
              )}
            </p>
          </div>

          {/* KPI compact chips — libellés fiables et non ambigus (LOT 38) */}
          <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
            <KpiChip icon={Building} value={projects.length} label="chantiers actifs" scheme="blue" />
            <KpiChip icon={ClipboardList} value={issuesOpen} label="réserves ouvertes" scheme="amber" />
            <KpiChip icon={AlertTriangle} value={criticalIssues.length} label="alertes critiques" scheme="red" />
            <KpiChip icon={Clock} value={lateTasks.length} label="tâches en retard" scheme="orange" />
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6">
        {isEmpty ? (
          /* ── Empty / Onboarding ── */
          <div className="flex flex-col items-center justify-center py-20 gap-8">
            <div className="text-center">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <h2 className="text-xl font-700 text-foreground mb-2">Bienvenue sur Kanvix</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Commencez par créer votre premier chantier pour voir votre tableau de bord prendre vie.
              </p>
            </div>
            <div className="w-full max-w-md bg-surface border border-border/50 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
              <h3 className="font-700 text-foreground text-sm">Démarrage rapide</h3>
              <div className="flex flex-col gap-3">
                <OnboardingStep done={false} label="Créer votre premier chantier" href="/chantiers/nouveau" cta="Créer →" />
                <OnboardingStep done={artisans.length > 0} label="Ajouter un artisan à l'équipe" href="/equipes" cta="Gérer les équipes →" />
                <OnboardingStep done={false} label="Planifier une première tâche" href="/planning" cta="Voir le planning →" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-6">

            {/* ── Ligne 1 : Planning (2/3) + À traiter (1/3) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-stretch">
              <WeekByDay tasks={weekTasks as any[]} today={today} artisans={artisans} teams={teams} />
              <TodayFocus
                lateTasks={lateTasks as any[]}
                blockedTasks={blockedTasks as any[]}
                criticalIssues={criticalIssues as any[]}
                total={priorityCount}
              />
            </div>

            {/* ── Ligne 2 : Équipes + Messagerie + Photos ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              <TeamAssignments artisans={artisans} tasks={tasks as any[]} teamMembers={teamMembers} teams={teams} today={today} />
              <MessagesTeam messages={messages} orgId={orgId} currentUserId={user.id} />
              <PhotoValidations photos={photos} canReview={canReviewPhotos} />
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

function OnboardingStep({
  done, label, href, cta,
}: {
  done: boolean; label: string; href: string; cta: string
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
      done ? 'border-green-500/30 bg-green-500/5' : 'border-border/60 bg-background'
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${
        done ? 'bg-green-500 border-green-500' : 'border-border'
      }`}>
        {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <span className={`text-sm flex-1 ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {label}
      </span>
      {!done && (
        <Link href={href} className="text-xs text-primary hover:underline font-500 shrink-0">{cta}</Link>
      )}
    </div>
  )
}
