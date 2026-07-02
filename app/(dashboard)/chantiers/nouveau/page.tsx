import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingChantier } from '@/components/chantiers/OnboardingChantier'

export default async function NouveauChantierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const orgId = (profileData as unknown as { org_id: string | null } | null)?.org_id
  if (!orgId) return redirect('/chantiers')

  const [{ data: artisansData }, { data: teamsData }] = await Promise.all([
    supabase
      .from('artisans')
      .select('id, full_name, trade, color')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .order('full_name'),
    supabase
      .from('teams')
      .select('id, name, color, type, members:team_members(artisan_id, artisan:artisans(id, full_name, trade, color))')
      .eq('org_id', orgId)
      .order('name'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OnboardingChantier
        orgId={orgId as string}
        userId={user.id}
        existingArtisans={(artisansData ?? []) as { id: string; full_name: string; trade: string; color: string }[]}
        existingTeams={(teamsData ?? []) as any}
      />
    </div>
  )
}
