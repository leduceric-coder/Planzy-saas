import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { SettingsClient } from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, phone, role, org_id, created_at')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    role: string | null
    org_id: string | null
    created_at: string | null
  } | null

  const orgId = profile?.org_id ?? null

  const { data: orgData } = orgId
    ? await supabase
        .from('organizations')
        .select('id, name, slug, plan')
        .eq('id', orgId)
        .single()
    : { data: null }

  const org = orgData as {
    id: string
    name: string
    slug: string
    plan: string | null
  } | null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Paramètres" subtitle="Gérez votre profil et votre organisation" />
      <div className="flex-1 overflow-y-auto px-10 pb-10">
        <SettingsClient profile={profile} org={org} />
      </div>
    </div>
  )
}
