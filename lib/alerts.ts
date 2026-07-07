// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = { from: (table: string) => any }

export type AlertType = 'late' | 'blocked' | 'issue' | 'message' | 'deadline'

export type AlertItem = {
  id: string
  type: AlertType
  title: string
  body: string
  link: string
}

export type AlertsSummary = {
  tasksLate: number
  tasksBlocked: number
  issuesCritical: number
  messagesRecent: number
  total: number
  items: AlertItem[]
}

export async function getAlertsSummary(
  supabase: AnySupabaseClient,
  orgId: string
): Promise<AlertsSummary> {
  const empty: AlertsSummary = {
    tasksLate: 0,
    tasksBlocked: 0,
    issuesCritical: 0,
    messagesRecent: 0,
    total: 0,
    items: [],
  }

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'active')

  const projectIds = ((projectsData ?? []) as { id: string }[]).map(p => p.id)
  if (projectIds.length === 0) return empty

  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const since48h = new Date(Date.now() - 48 * 3600000).toISOString()

  const [lateRes, blockedRes, issuesRes, messagesRes, deadlineRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, project_id, project:projects(name)')
      .in('project_id', projectIds)
      .lt('end_date', today)
      .not('status', 'in', '(done,validated)')
      .order('end_date', { ascending: true })
      .limit(10),

    supabase
      .from('tasks')
      .select('id, title, project_id, project:projects(name)')
      .in('project_id', projectIds)
      .eq('status', 'blocked')
      .limit(10),

    supabase
      .from('issues')
      .select('id, title, project_id, priority, project:projects(name)')
      .in('project_id', projectIds)
      .not('status', 'in', '(fixed,validated,rejected)')
      .in('priority', ['high', 'critical'])
      .limit(10),

    supabase
      .from('messages')
      .select('id, content, project_id, project:projects(name)')
      .in('project_id', projectIds)
      .gte('created_at', since48h)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('tasks')
      .select('id, title, end_date, project_id, project:projects(name)')
      .in('project_id', projectIds)
      .gte('end_date', today)
      .lte('end_date', in7Days)
      .not('status', 'in', '(done,validated)')
      .limit(10),
  ])

  const lateTasks = ((lateRes.data ?? []) as any[])
  const blockedTasks = ((blockedRes.data ?? []) as any[])
  const criticalIssues = ((issuesRes.data ?? []) as any[])
  const recentMessages = ((messagesRes.data ?? []) as any[])
  const deadlineTasks = ((deadlineRes.data ?? []) as any[])

  // Deduplicate: tasks already in late or blocked lists must not appear in deadline
  const alreadyAlertedIds = new Set([
    ...lateTasks.map((t: any) => t.id),
    ...blockedTasks.map((t: any) => t.id),
  ])

  const items: AlertItem[] = [
    ...lateTasks.map((t: any) => ({
      id: `late-${t.id}`,
      type: 'late' as AlertType,
      title: 'Tâche en retard',
      body: `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}`,
      link: `/chantiers/${t.project_id}`,
    })),
    ...blockedTasks.map((t: any) => ({
      id: `blocked-${t.id}`,
      type: 'blocked' as AlertType,
      title: 'Tâche bloquée',
      body: `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}`,
      link: `/chantiers/${t.project_id}`,
    })),
    ...criticalIssues.map((i: any) => ({
      id: `issue-${i.id}`,
      type: 'issue' as AlertType,
      title: i.priority === 'critical' ? 'Réserve critique' : 'Réserve haute priorité',
      body: `${i.title}${i.project?.name ? ` — ${i.project.name}` : ''}`,
      link: `/chantiers/${i.project_id}`,
    })),
    ...recentMessages.map((m: any) => {
      // LOT 33 — Contextualiser l'alerte : nom du chantier + extrait, et lien
      // profond vers la conversation du chantier concerné (/messages?project=…).
      const projectName = m.project?.name as string | undefined
      const excerpt = (m.content as string | null)?.slice(0, 60) ?? ''
      return {
        id: `msg-${m.id}`,
        type: 'message' as AlertType,
        title: projectName ? `Nouveau message — ${projectName}` : 'Nouveau message',
        body: projectName && excerpt ? `${projectName} · ${excerpt}` : (projectName ?? excerpt),
        link: m.project_id ? `/messages?project=${m.project_id}` : '/messages',
      }
    }),
    ...deadlineTasks
      .filter((t: any) => !alreadyAlertedIds.has(t.id))
      .map((t: any) => ({
        id: `deadline-${t.id}`,
        type: 'deadline' as AlertType,
        title: 'Échéance dans 7 jours',
        body: `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}`,
        link: '/planning',
      })),
  ]

  return {
    tasksLate: lateTasks.length,
    tasksBlocked: blockedTasks.length,
    issuesCritical: criticalIssues.length,
    messagesRecent: recentMessages.length,
    total: items.length,
    items,
  }
}
