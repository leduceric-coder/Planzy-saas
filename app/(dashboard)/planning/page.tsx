import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { PlanningTabs } from '@/components/planning/PlanningTabs'

export default async function PlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

  const [
    { data: tasks },
    { data: projects },
    { data: artisans },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        *,
        assignee:artisans(id, full_name, color, trade),
        team:teams(id, name, color),
        project:projects(id, name, color)
      `)
      .eq('org_id', profile?.org_id ?? '')
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)
      .order('start_date', { ascending: true }),
    supabase
      .from('projects')
      .select('id, name, color, status')
      .eq('org_id', profile?.org_id ?? '')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('artisans')
      .select('id, full_name, trade, color')
      .eq('org_id', profile?.org_id ?? '')
      .order('full_name'),
    supabase
      .from('teams')
      .select('id, name, color')
      .eq('org_id', profile?.org_id ?? '')
      .order('name'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Planning global"
        subtitle="Vue Gantt de tous les chantiers actifs"
      />
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <Suspense fallback={null}>
          <PlanningTabs tasks={tasks ?? []} projects={projects ?? []} artisans={artisans ?? []} teams={teams ?? []} />
        </Suspense>
      </div>
    </div>
  )
}
