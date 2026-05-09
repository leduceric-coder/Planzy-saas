import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { GanttView } from '@/components/planning/GanttView'

export default async function PlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:artisans(id, full_name, color),
      project:projects(id, name, color)
    `)
    .eq('org_id', profile?.org_id)
    .not('start_date', 'is', null)
    .not('end_date', 'is', null)
    .order('start_date', { ascending: true })

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color, status')
    .eq('org_id', profile?.org_id)
    .eq('status', 'active')
    .order('name')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Planning global"
        subtitle="Vue Gantt de tous les chantiers actifs"
      />
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <GanttView tasks={tasks ?? []} projects={projects ?? []} />
      </div>
    </div>
  )
}
