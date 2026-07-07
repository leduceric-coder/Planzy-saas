import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { PlanningTabs } from '@/components/planning/PlanningTabs'
import type { Task } from '@/lib/types'

type GanttTask = Task & {
  assignee?: { id: string; full_name: string; color: string } | null
  assigned_team?: string | null
  team?: { id: string; name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

type GanttProject = { id: string; name: string; color: string }
type GanttArtisan = { id: string; full_name: string; trade: string; color: string }

interface PageProps {
  searchParams: Promise<{ focus?: string; id?: string }>
}

export default async function PlanningPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const initialFocusTaskId = sp.focus === 'task' ? sp.id : undefined
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const profile = profileData as unknown as { org_id: string | null } | null
  const orgId = profile?.org_id

  if (!orgId) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-2">Planning global</h1>
        <p className="text-sm text-red-500">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  // Fetch active projects first — tasks are scoped to active projects only
  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, name, color, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('name')

  const projects = (projectsData ?? []) as unknown as GanttProject[]
  const activeProjectIds = projects.map(p => p.id)

  // Fetch tasks only for active projects (excludes archived/paused project data)
  const [
    { data: tasksData },
    { data: undatedData },
    { data: artisansData },
    { data: teamsData },
  ] = await Promise.all([
    activeProjectIds.length > 0
      ? supabase
          .from('tasks')
          .select('*, assignee:artisans(id, full_name, color), team:teams(id, name, color), project:projects(id, name, color)')
          .in('project_id', activeProjectIds)
          .not('start_date', 'is', null)
          .not('end_date', 'is', null)
          .order('start_date', { ascending: true })
      : Promise.resolve({ data: [] } as any),
    activeProjectIds.length > 0
      ? supabase
          .from('tasks')
          .select('*, assignee:artisans(id, full_name, color), team:teams(id, name, color), project:projects(id, name, color)')
          .in('project_id', activeProjectIds)
          .or('start_date.is.null,end_date.is.null')
          .not('status', 'in', '(done,validated,archived)')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] } as any),
    supabase
      .from('artisans')
      .select('id, full_name, color, trade')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .order('full_name'),
    supabase
      .from('teams')
      .select('id, name, color, type, members:team_members(artisan_id)')
      .eq('org_id', orgId)
      .order('name'),
  ])

  const tasks = (tasksData ?? []) as unknown as GanttTask[]
  const undatedTasks = (undatedData ?? []) as unknown as GanttTask[]
  const artisans = (artisansData ?? []) as unknown as GanttArtisan[]
  const teams = ((teamsData ?? []) as Array<{
    id: string; name: string; color: string | null; type: string | null
    members: { artisan_id: string }[]
  }>).map(t => ({ id: t.id, name: t.name, color: t.color, type: t.type, memberCount: t.members?.length ?? 0 }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Planning global"
        subtitle="Vue Gantt de tous les chantiers actifs"
      />
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <PlanningTabs
          tasks={tasks}
          projects={projects}
          artisans={artisans}
          teams={teams}
          undatedTasks={undatedTasks}
          initialFocusTaskId={initialFocusTaskId}
          orgId={orgId}
        />
      </div>
    </div>
  )
}
