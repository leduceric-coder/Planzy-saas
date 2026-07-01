import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { TaskAlertList } from '@/components/dashboard/TaskAlertList'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // KPIs
  const orgId = profile?.org_id ?? ''

  const [
    { data: projects },
    { count: tasksLate },
    { count: tasksBlocked },
    { count: issuesOpen },
    { data: tasks },
    { data: logs },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('org_id', orgId).eq('status', 'active').order('updated_at', { ascending: false }).limit(6),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .lt('end_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '(done,validated)'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'blocked'),
    supabase.from('issues').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'open'),
    supabase.from('tasks').select('*, assignee:artisans(full_name,color), project:projects(name)')
      .eq('org_id', orgId)
      .not('status', 'in', '(done,validated)')
      .order('end_date', { ascending: true })
      .limit(8),
    supabase.from('activity_logs').select('*, profile:profiles(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'vous'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={`${greeting()}, ${firstName}`}
        subtitle={`${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <Link href="/chantiers/nouveau">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouveau chantier
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Chantiers actifs"
            value={projects?.length ?? 0}
            icon="building"
            color="blue"
            delta="+2 ce mois"
            deltaType="positive"
          />
          <KpiCard
            label="Tâches en retard"
            value={tasksLate ?? 0}
            icon="clock"
            color="red"
            delta={tasksLate ? 'Attention requise' : 'Tout est à jour'}
            deltaType={tasksLate ? 'negative' : 'positive'}
          />
          <KpiCard
            label="Tâches bloquées"
            value={tasksBlocked ?? 0}
            icon="alert"
            color="orange"
            delta="À traiter en priorité"
            deltaType={tasksBlocked ? 'negative' : 'neutral'}
          />
          <KpiCard
            label="Réserves ouvertes"
            value={issuesOpen ?? 0}
            icon="flag"
            color="orange"
            delta="Signalements actifs"
            deltaType="neutral"
          />
        </div>

        {/* Projects + Activity split */}
        <div className="grid grid-cols-3 gap-6">
          {/* Projects grid — 2/3 */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
                Chantiers actifs
              </h2>
              <Link href="/chantiers" className="text-xs text-primary hover:underline font-500">
                Voir tous →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {projects?.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {!projects?.length && (
                <div className="col-span-2 text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  Aucun chantier actif.{' '}
                  <Link href="/chantiers/nouveau" className="text-primary hover:underline">
                    Créer un chantier
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Activity feed — 1/3 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
              Activité récente
            </h2>
            <ActivityFeed logs={logs ?? []} />
          </div>
        </div>

        {/* Tasks alerts */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
            Tâches prioritaires
          </h2>
          <TaskAlertList tasks={tasks ?? []} />
        </div>
      </div>
    </div>
  )
}
