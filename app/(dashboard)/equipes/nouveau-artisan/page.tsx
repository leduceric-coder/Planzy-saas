import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { NouvelArtisanForm } from '@/components/equipes/NouvelArtisanForm'

export default async function NouvelArtisanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const orgId = (profileData as unknown as { org_id: string | null } | null)?.org_id
  if (!orgId) return redirect('/equipes')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Nouvel artisan"
        subtitle="Ajoutez un artisan ou sous-traitant à votre organisation"
      />
      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-2xl">
          <NouvelArtisanForm orgId={orgId as string} />
        </div>
      </div>
    </div>
  )
}
