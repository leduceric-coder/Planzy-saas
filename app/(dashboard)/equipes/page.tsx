import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Users, Phone, Mail } from 'lucide-react'

export default async function EquipesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

  const [{ data: teams }, { data: artisans }] = await Promise.all([
    supabase.from('teams').select('*, lead:artisans!lead_id(full_name,trade), members:team_members(*, artisan:artisans(id,full_name,trade,color))').eq('org_id', profile?.org_id ?? ''),
    supabase.from('artisans').select('*').eq('org_id', profile?.org_id ?? '').order('full_name'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Équipes & Artisans"
        subtitle={`${artisans?.length ?? 0} artisans · ${teams?.length ?? 0} équipes`}
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col gap-8">
        {/* Teams */}
        {teams && teams.length > 0 && (
          <section>
            <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Équipes</h2>
            <div className="grid grid-cols-3 gap-4">
              {teams.map((team: any) => (
                <div key={team.id} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-border/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: team.color + '22', border: `2px solid ${team.color}` }}>
                      <Users className="h-5 w-5" style={{ color: team.color }} />
                    </div>
                    <div>
                      <h3 className="font-700 text-foreground">{team.name}</h3>
                      {team.lead && <p className="text-xs text-muted-foreground">Chef : {team.lead.full_name}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {team.members?.map((m: any) => (
                      <div
                        key={m.artisan_id}
                        className="flex items-center gap-1.5 bg-elevated border border-border rounded-full px-2.5 py-1 text-xs font-500 text-foreground"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.artisan?.color }} />
                        {m.artisan?.full_name}
                      </div>
                    ))}
                    {(!team.members || team.members.length === 0) && (
                      <span className="text-xs text-muted-foreground">Aucun membre</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Artisans */}
        <section>
          <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Artisans ({artisans?.length ?? 0})</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {artisans?.map((artisan: any) => (
                <div key={artisan.id} className="flex items-center gap-4 px-6 py-4 hover:bg-elevated transition-colors">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-700 shrink-0"
                    style={{ background: artisan.color }}
                  >
                    {artisan.full_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-600 text-foreground">{artisan.full_name}</p>
                    <p className="text-xs text-muted-foreground">{artisan.trade}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    {artisan.phone && (
                      <a href={`tel:${artisan.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                        <Phone className="h-3.5 w-3.5" />
                        {artisan.phone}
                      </a>
                    )}
                    {artisan.email && (
                      <a href={`mailto:${artisan.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                        <Mail className="h-3.5 w-3.5" />
                        {artisan.email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {!artisans?.length && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Aucun artisan enregistré
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
