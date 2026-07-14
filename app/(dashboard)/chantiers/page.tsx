import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ChantiersClient } from '@/components/chantiers/ChantiersClient'
import type { EnrichedProject, ProjectStats } from '@/components/chantiers/ChantiersClient'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CanDo } from '@/components/layout/CanDo'
import type { Project } from '@/lib/types'

export default async function ChantiersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single()

  const orgId = (profileData as any)?.org_id as string | null
  if (!orgId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Chantiers</h1>
        <p className="text-sm text-red-500">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, org_id, name, address, description, status, start_date, end_date, progress, color, image_url, created_at, updated_at, budget, created_by')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  const projects = (projectsData ?? []) as unknown as Project[]
  const projectIds = projects.map(p => p.id)

  // ── Enrichment data: tasks, issues, artisans ──
  let taskRows:    any[] = []
  let issueRows:   any[] = []
  let artisanRows: any[] = []

  if (projectIds.length > 0) {
    const [{ data: t }, { data: i }, { data: a }] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, project_id, status, end_date, assigned_to')
        .in('project_id', projectIds),
      supabase
        .from('issues')
        .select('id, project_id, status, priority')
        .in('project_id', projectIds)
        .not('status', 'in', '(fixed,validated,rejected)'),
      supabase
        .from('artisans')
        .select('id, full_name, color')
        .eq('org_id', orgId)
        .eq('is_archived', false),
    ])
    taskRows    = t  ?? []
    issueRows   = i  ?? []
    artisanRows = a  ?? []
  }

  // Artisan lookup map
  const artisanById = new Map<string, { id: string; full_name: string; color: string }>(
    artisanRows.map((a: any) => [
      a.id as string,
      { id: a.id, full_name: (a.full_name as string) ?? '', color: (a.color as string) ?? '#6366f1' },
    ])
  )

  // ── Compute per-project stats ──
  const enriched: EnrichedProject[] = projects.map(p => {
    const tasks  = (taskRows  as any[]).filter(t => t.project_id === p.id)
    const issues = (issueRows as any[]).filter(i => i.project_id === p.id)

    const totalTasks   = tasks.length
    const doneTasks    = tasks.filter((t: any) => t.status === 'done' || t.status === 'validated').length
    const blockedTasks = tasks.filter((t: any) => t.status === 'blocked').length
    const reviewTasks  = tasks.filter((t: any) => t.status === 'review').length
    const lateTasks    = tasks.filter((t: any) =>
      t.end_date &&
      (t.end_date as string) < today &&
      t.status !== 'done' &&
      t.status !== 'validated'
    ).length

    const openIssues     = issues.length
    const criticalIssues = issues.filter((i: any) => i.priority === 'critical').length

    // Unique artisans assigned to tasks in this project
    const artisanIds = [...new Set(
      tasks
        .map((t: any) => t.assigned_to as string | null)
        .filter((id): id is string => id !== null && id !== undefined)
    )]
    const artisans = artisanIds
      .map(id => artisanById.get(id))
      .filter((a): a is { id: string; full_name: string; color: string } => Boolean(a))
      .slice(0, 5)

    const isAtRisk = p.status === 'active' && (criticalIssues > 0 || blockedTasks > 0 || lateTasks > 0)

    const stats: ProjectStats = {
      totalTasks, doneTasks, lateTasks, blockedTasks, reviewTasks,
      openIssues, criticalIssues, artisans, isAtRisk,
    }
    return { ...p, stats }
  })

  // ── Header subtitle ──
  const active    = projects.filter(p => p.status === 'active').length
  const paused    = projects.filter(p => p.status === 'paused').length
  const completed = projects.filter(p => p.status === 'completed').length
  const atRisk    = enriched.filter(p => p.stats.isAtRisk).length

  const subtitle = projects.length === 0
    ? 'Aucun chantier'
    : [
        active    > 0 ? `${active} actif${active > 1 ? 's' : ''}`             : null,
        paused    > 0 ? `${paused} en pause`                                   : null,
        completed > 0 ? `${completed} terminé${completed > 1 ? 's' : ''}`     : null,
        atRisk    > 0 ? `${atRisk} à risque`                                   : null,
      ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Chantiers"
        subtitle={subtitle}
        actions={
          <CanDo action="chantier.create">
            <Link href="/chantiers/nouveau">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Nouveau chantier
              </Button>
            </Link>
          </CanDo>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <ChantiersClient projects={enriched} today={today} />
      </div>
    </div>
  )
}
