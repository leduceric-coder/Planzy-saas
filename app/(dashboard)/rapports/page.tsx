import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Globe } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RapportsClient } from '@/components/rapports/RapportsClient'
import { PrintButton } from '@/components/rapports/PrintButton'
import type { AlertEntry } from '@/components/rapports/RapportsClient'

type ReportRow = {
  id: string
  title: string | null
  type: string | null
  created_at: string | null
  project: { name: string | null; color: string } | null
  author: { full_name: string | null } | null
}

type RawTask = {
  id: string
  title: string
  project_id: string
  end_date: string | null
  project: { name: string; color: string } | null
}

type RawIssue = {
  id: string
  title: string
  project_id: string
  priority: string | null
  project: { name: string; color: string } | null
}

export default async function RapportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  const orgId = (profileData as { org_id: string | null } | null)?.org_id

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // ── Projects ────────────────────────────────────────────────────────────────

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('org_id', orgId)
    .in('status', ['active', 'paused'])
    .order('name')

  const projects = (projectsData ?? []) as { id: string; name: string; color: string }[]
  const projectIds = projects.map(p => p.id)

  // ── Parallel data fetches ────────────────────────────────────────────────────

  const [lateRes, blockedRes, issuesRes, reportsRes] = await Promise.all([
    projectIds.length > 0
      ? supabase
          .from('tasks')
          .select('id, title, project_id, end_date, project:projects(name,color)')
          .in('project_id', projectIds)
          .lt('end_date', todayStr)
          .not('status', 'in', '(done,validated,archived)')
          .order('end_date', { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase
          .from('tasks')
          .select('id, title, project_id, end_date, project:projects(name,color)')
          .in('project_id', projectIds)
          .eq('status', 'blocked')
          .limit(50)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase
          .from('issues')
          .select('id, title, project_id, priority, project:projects(name,color)')
          .in('project_id', projectIds)
          .not('status', 'in', '(fixed,validated,rejected)')
          .limit(60)
      : Promise.resolve({ data: [] }),
    supabase
      .from('reports')
      .select('*, project:projects(name,color), author:profiles!generated_by(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const lateTasks   = (lateRes.data    ?? []) as RawTask[]
  const blockedTasks = (blockedRes.data ?? []) as RawTask[]
  const issues      = (issuesRes.data   ?? []) as RawIssue[]
  const reports     = (reportsRes.data  ?? []) as ReportRow[]

  // ── Derived data ──────────────────────────────────────────────────────────

  const criticalIssues = issues.filter(i => i.priority === 'critical')
  const highIssues     = issues.filter(i => i.priority === 'high')

  // KPIs
  const criticalCount    = criticalIssues.length + blockedTasks.length
  const openIssuesCount  = issues.length
  const lateTasksCount   = lateTasks.length
  const atRiskProjectIds = new Set<string>([
    ...criticalIssues.map(i => i.project_id),
    ...blockedTasks.map(t => t.project_id),
    ...lateTasks.map(t => t.project_id),
  ])
  const atRiskCount = atRiskProjectIds.size

  // ── Build alert entries ────────────────────────────────────────────────────

  const alertEntries: AlertEntry[] = []

  for (const issue of criticalIssues) {
    alertEntries.push({
      id: `issue-critical-${issue.id}`,
      kind: 'critical_issue',
      title: issue.title,
      projectName: issue.project?.name ?? null,
      projectColor: issue.project?.color ?? null,
      projectId: issue.project_id,
      date: null,
      daysLate: null,
    })
  }

  for (const task of blockedTasks) {
    alertEntries.push({
      id: `blocked-${task.id}`,
      kind: 'blocked_task',
      title: task.title,
      projectName: task.project?.name ?? null,
      projectColor: task.project?.color ?? null,
      projectId: task.project_id,
      date: task.end_date,
      daysLate: null,
    })
  }

  for (const task of lateTasks) {
    const daysLate = task.end_date
      ? Math.ceil((today.getTime() - new Date(task.end_date).getTime()) / 86400000)
      : null
    alertEntries.push({
      id: `late-${task.id}`,
      kind: 'late_task',
      title: task.title,
      projectName: task.project?.name ?? null,
      projectColor: task.project?.color ?? null,
      projectId: task.project_id,
      date: task.end_date,
      daysLate,
    })
  }

  for (const issue of highIssues) {
    alertEntries.push({
      id: `issue-high-${issue.id}`,
      kind: 'high_issue',
      title: issue.title,
      projectName: issue.project?.name ?? null,
      projectColor: issue.project?.color ?? null,
      projectId: issue.project_id,
      date: null,
      daysLate: null,
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Rapports & alertes"
        subtitle="Suivez les dérives, réserves et rapports de vos chantiers."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/rapports/global">
              <Button size="sm" variant="outline">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Rapport global</span>
              </Button>
            </Link>
            <PrintButton />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <RapportsClient
          orgId={orgId}
          userId={user.id}
          projects={projects}
          alerts={alertEntries}
          kpis={{ criticalCount, openIssuesCount, lateTasksCount, atRiskCount }}
          reports={reports}
        />
      </div>
    </div>
  )
}
