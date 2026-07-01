import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ChantiersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', profile?.org_id ?? '')
    .order('updated_at', { ascending: false })

  const active = projects?.filter(p => p.status === 'active') ?? []
  const paused = projects?.filter(p => p.status === 'paused') ?? []
  const completed = projects?.filter(p => p.status === 'completed') ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Chantiers"
        subtitle={`${active.length} actifs, ${paused.length} en pause, ${completed.length} terminés`}
        actions={
          <Link href="/chantiers/nouveau">
            <Button size="sm"><Plus className="h-4 w-4" />Nouveau chantier</Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col gap-8">
        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">
              En cours — {active.length}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {active.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        )}

        {paused.length > 0 && (
          <section>
            <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">
              En pause — {paused.length}
            </h2>
            <div className="grid grid-cols-3 gap-4 opacity-70">
              {paused.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        )}

        {completed.length > 0 && (
          <section>
            <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">
              Terminés — {completed.length}
            </h2>
            <div className="grid grid-cols-3 gap-4 opacity-50">
              {completed.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        )}

        {!projects?.length && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-20">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-700 text-foreground mb-1">Aucun chantier</h3>
              <p className="text-sm text-muted-foreground mb-4">Commencez par créer votre premier chantier</p>
              <Link href="/chantiers/nouveau">
                <Button>Créer un chantier</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
