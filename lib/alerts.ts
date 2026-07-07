import { RECENT_WINDOW_MS } from '@/lib/messages-activity'

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
  orgId: string,
  currentUserId?: string,
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
  const since48h = new Date(Date.now() - RECENT_WINDOW_MS).toISOString()

  // LOT 35 — messages ENTRANTS récents : exclut l'utilisateur courant.
  // sender_id NULL (système) = entrant → inclus. Filtrage org via projectIds/RLS.
  let messagesQuery = supabase
    .from('messages')
    .select('id, content, project_id, created_at, project:projects(name), sender:profiles!sender_id(full_name)', { count: 'exact' })
    .in('project_id', projectIds)
    .gte('created_at', since48h)
    .order('created_at', { ascending: false })
    .limit(20)
  if (currentUserId) {
    messagesQuery = messagesQuery.or(`sender_id.is.null,sender_id.neq.${currentUserId}`)
  }

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

    messagesQuery,

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
    // LOT 35 — Une alerte par chantier (le dernier message entrant), pour éviter
    // une avalanche. recentMessages est trié desc → le 1er vu par chantier est le
    // plus récent. Messages sans project_id regroupés sous « Général ».
    ...dedupeMessagesByProject(recentMessages).map((m: any) => {
      const projectName = m.project?.name as string | undefined
      const author = (m.sender?.full_name as string | undefined) ?? 'Équipe'
      const excerpt = (m.content as string | null)?.slice(0, 60) ?? ''
      const label = projectName ?? 'Général'
      return {
        id: `msg-${m.id}`,
        type: 'message' as AlertType,
        title: `Nouveau message reçu — ${label}`,
        body: excerpt ? `${author} : ${excerpt}` : author,
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

  // Compteur exact des messages entrants récents (peut dépasser la limite de 20
  // rapportée dans recentMessages) — c'est la valeur du badge « reçus récemment ».
  const messagesRecent = (messagesRes as { count?: number | null }).count ?? recentMessages.length

  return {
    tasksLate: lateTasks.length,
    tasksBlocked: blockedTasks.length,
    issuesCritical: criticalIssues.length,
    messagesRecent,
    total: items.length,
    items,
  }
}

// Une entrée par chantier (le 1er = le plus récent, la liste étant triée desc).
// Les messages sans project_id sont regroupés sous la clé « general ».
function dedupeMessagesByProject<T extends { project_id?: string | null }>(msgs: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const m of msgs) {
    const key = m.project_id ?? 'general'
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out
}
