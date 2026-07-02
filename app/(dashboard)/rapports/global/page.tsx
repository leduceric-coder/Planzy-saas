import { createClient } from '@/lib/supabase/server'
import { RapportGlobalView } from '@/components/rapports/RapportGlobalView'

const SIGNED_URL_TTL = 3600 // 1 hour

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

export default async function RapportGlobalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const profile = profileData as unknown as { org_id: string | null } | null
  const orgId = profile?.org_id

  if (!orgId) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-2">Rapport global</h1>
        <p className="text-sm text-red-500">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  // Fetch active/paused projects
  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, name, color, progress, status, start_date, end_date')
    .eq('org_id', orgId)
    .in('status', ['active', 'paused'])
    .order('name')

  const projects = (projectsData ?? []) as {
    id: string
    name: string
    color: string
    progress: number
    status: string
    start_date: string | null
    end_date: string | null
  }[]

  const activeProjectIds = projects.map(p => p.id)

  // Parallel fetch of tasks, issues, activity, documents, photos
  const [
    { data: tasksData },
    { data: issuesData },
    { data: activityData },
    { data: documentsData },
    { data: photosRaw },
  ] = await Promise.all([
    activeProjectIds.length > 0
      ? supabase
          .from('tasks')
          .select('id, project_id, status, end_date, title, priority')
          .in('project_id', activeProjectIds)
      : Promise.resolve({ data: [] }),
    activeProjectIds.length > 0
      ? supabase
          .from('issues')
          .select('id, project_id, status, priority, title')
          .in('project_id', activeProjectIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('activity_logs')
      .select('id, action, entity_type, created_at, project_id, project:projects(name,color), profile:profiles!user_id(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('documents')
      .select('id, name, category, created_at, project_id, project:projects(name,color)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('photos')
      .select('id, url, storage_path, caption, taken_at, project_id, project:projects(name)')
      .eq('org_id', orgId)
      .order('taken_at', { ascending: false })
      .limit(8),
  ])

  const tasks = (tasksData ?? []) as {
    id: string
    project_id: string
    status: string
    end_date: string | null
    title: string
    priority: string | null
  }[]

  const issues = (issuesData ?? []) as {
    id: string
    project_id: string
    status: string
    priority: string | null
    title: string
  }[]

  const activityRaw = (activityData ?? []) as any[]
  const docsRaw = (documentsData ?? []) as any[]
  const photosArray = (photosRaw ?? []) as any[]

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const DONE_STATUSES = ['done', 'validated', 'archived', 'blocked']
  const ISSUE_CLOSED = ['fixed', 'validated', 'rejected']

  // Compute ProjectStat for each project
  const projectStats: ProjectStat[] = projects.map(p => {
    const pTasks = tasks.filter(t => t.project_id === p.id)
    const pIssues = issues.filter(i => i.project_id === p.id)

    const taskTotal = pTasks.length
    const taskDone = pTasks.filter(t => ['done', 'validated', 'archived'].includes(t.status)).length
    const taskInProgress = pTasks.filter(t => t.status === 'in_progress').length
    const taskBlocked = pTasks.filter(t => t.status === 'blocked').length
    const taskTodo = pTasks.filter(t => t.status === 'todo').length
    const taskLate = pTasks.filter(t =>
      t.end_date != null &&
      t.end_date < todayStr &&
      !DONE_STATUSES.includes(t.status)
    ).length

    const issueOpen = pIssues.filter(i => !ISSUE_CLOSED.includes(i.status)).length
    const issueCritical = pIssues.filter(
      i => !ISSUE_CLOSED.includes(i.status) && i.priority === 'critical'
    ).length

    // Next deadline: soonest future end_date among todo/in_progress tasks
    const upcomingTasks = pTasks
      .filter(t =>
        ['todo', 'in_progress'].includes(t.status) &&
        t.end_date != null &&
        t.end_date >= todayStr
      )
      .sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''))

    const nextTask = upcomingTasks[0] ?? null

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      progress: p.progress ?? 0,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      taskTotal,
      taskTodo,
      taskInProgress,
      taskDone,
      taskBlocked,
      taskLate,
      issueOpen,
      issueCritical,
      nextDeadlineTitle: nextTask?.title ?? null,
      nextDeadline: nextTask?.end_date ?? null,
    }
  })

  // Build alert items (max 20)
  const projectById = new Map(projects.map(p => [p.id, p]))

  const alertItems: AlertItem[] = []

  // critical issues
  for (const issue of issues) {
    if (ISSUE_CLOSED.includes(issue.status)) continue
    if (issue.priority !== 'critical') continue
    const p = projectById.get(issue.project_id)
    if (!p) continue
    alertItems.push({
      type: 'critical_issue',
      title: issue.title,
      projectName: p.name,
      projectColor: p.color,
      date: null,
      priority: issue.priority,
    })
  }

  // blocked tasks
  for (const task of tasks) {
    if (task.status !== 'blocked') continue
    const p = projectById.get(task.project_id)
    if (!p) continue
    alertItems.push({
      type: 'blocked_task',
      title: task.title,
      projectName: p.name,
      projectColor: p.color,
      date: task.end_date,
      priority: task.priority,
    })
  }

  // late tasks
  for (const task of tasks) {
    if (
      task.end_date == null ||
      task.end_date >= todayStr ||
      DONE_STATUSES.includes(task.status)
    ) continue
    const p = projectById.get(task.project_id)
    if (!p) continue
    alertItems.push({
      type: 'late_task',
      title: task.title,
      projectName: p.name,
      projectColor: p.color,
      date: task.end_date,
      priority: task.priority,
    })
  }

  const trimmedAlerts = alertItems.slice(0, 20)

  // Activity items
  const activityItems = activityRaw.map((a: any) => ({
    id: a.id as string,
    action: a.action as string,
    entity_type: a.entity_type as string,
    created_at: a.created_at as string,
    projectName: (a.project as any)?.name ?? null,
    projectColor: (a.project as any)?.color ?? null,
    authorName: (a.profile as any)?.full_name ?? null,
  }))

  // Recent docs
  const recentDocs = docsRaw.map((d: any) => ({
    id: d.id as string,
    name: d.name as string,
    projectName: (d.project as any)?.name ?? null,
    projectColor: (d.project as any)?.color ?? null,
    created_at: d.created_at as string,
    category: d.category as string | null,
  }))

  // Signed URLs for photos
  const photoPaths = photosArray
    .map((p: any, i: number) => ({ path: p.storage_path as string | null, index: i }))
    .filter(x => x.path)

  const photoSignedResult = photoPaths.length > 0
    ? await supabase.storage.from('photos').createSignedUrls(photoPaths.map(x => x.path!), SIGNED_URL_TTL)
    : { data: null }

  const photosWithUrls = photosArray.map((p: any, i: number) => {
    const pathEntry = photoPaths.find(x => x.index === i)
    if (pathEntry && photoSignedResult.data) {
      const pos = photoPaths.indexOf(pathEntry)
      const signedUrl = photoSignedResult.data[pos]?.signedUrl
      if (signedUrl) return { ...p, url: signedUrl }
    }
    return p
  })

  const recentPhotos = photosWithUrls.map((p: any) => ({
    id: p.id as string,
    url: (p.url as string) ?? '',
    projectName: (p.project as any)?.name ?? null,
    caption: p.caption as string | null,
    taken_at: p.taken_at as string,
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RapportGlobalView
        projectStats={projectStats}
        alertItems={trimmedAlerts}
        activityItems={activityItems}
        recentDocs={recentDocs}
        recentPhotos={recentPhotos}
        generatedAt={new Date().toISOString()}
      />
    </div>
  )
}
