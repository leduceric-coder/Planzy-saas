import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { BarChart3, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function RapportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

  const [{ data: reports }, { data: projects }] = await Promise.all([
    supabase.from('reports').select('*, project:projects(name,color), author:profiles!generated_by(full_name)')
      .eq('org_id', profile?.org_id ?? '').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, progress, status, start_date, end_date')
      .eq('org_id', profile?.org_id ?? '').eq('status', 'active'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Rapports"
        subtitle={`${reports?.length ?? 0} rapports générés`}
        actions={<Button size="sm"><Plus className="h-4 w-4" />Générer un rapport</Button>}
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col gap-8">
        {/* Portfolio overview */}
        <section>
          <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Vue portfolio</h2>
          <div className="grid grid-cols-3 gap-4">
            {projects?.map((p: any) => {
              const daysLeft = p.end_date
                ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000)
                : null

              return (
                <div key={p.id} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-600 text-foreground text-sm leading-snug">{p.name}</h3>
                    {daysLeft !== null && (
                      <span className={`text-xs font-600 shrink-0 px-2 py-1 rounded-lg ${daysLeft < 0 ? 'bg-destructive/15 text-destructive' : daysLeft < 14 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-primary/15 text-primary'}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}j retard` : `${daysLeft}j`}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Avancement</span>
                      <span className="font-700 text-foreground">{p.progress}%</span>
                    </div>
                    <div className="h-2 bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Reports list */}
        <section>
          <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Historique des rapports</h2>
          {reports && reports.length > 0 ? (
            <div className="flex flex-col gap-3">
              {reports.map((report: any) => (
                <div key={report.id} className="bg-surface border border-border rounded-xl p-5 flex items-start justify-between gap-4 hover:border-border/60 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-600 text-foreground mb-1">{report.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {report.project && (
                          <span
                            className="flex items-center gap-1"
                            style={{ color: report.project.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: report.project.color }} />
                            {report.project.name}
                          </span>
                        )}
                        <span>{formatDate(report.created_at)}</span>
                        {report.author && <span>{report.author.full_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs bg-elevated border border-border px-2.5 py-1 rounded-lg font-600 text-muted-foreground">
                      {report.type === 'weekly' ? 'Hebdo' : report.type === 'monthly' ? 'Mensuel' : report.type}
                    </span>
                    <Button variant="outline" size="sm">Voir</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm mb-3">Aucun rapport généré</p>
              <Button size="sm"><Plus className="h-4 w-4" />Générer le premier rapport</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
