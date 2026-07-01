import { createClient } from '@/lib/supabase/server'
import { MobileArtisanView } from '@/components/mobile/MobileArtisanView'
import { redirect } from 'next/navigation'

export default async function MobilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Get artisan linked to this user
  const { data: artisan } = await supabase
    .from('artisans')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Get tasks assigned to this artisan
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, project:projects(id,name,color)')
    .eq('assigned_to', artisan?.id ?? '')
    .not('status', 'in', '(done,validated)')
    .order('end_date', { ascending: true })

  // Get recent messages for this artisan
  const { data: messages } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(full_name,avatar_url), project:projects(name,color)')
    .eq('org_id', profile?.org_id ?? '')
    .order('created_at', { ascending: false })
    .limit(20)

  // Get issues reported by this artisan
  const { data: issues } = await supabase
    .from('issues')
    .select('*, project:projects(name)')
    .eq('reported_by', user.id)
    .not('status', 'in', '(validated,rejected)')
    .order('created_at', { ascending: false })

  return (
    <MobileArtisanView
      profile={profile}
      artisan={artisan}
      tasks={tasks ?? []}
      messages={messages ?? []}
      issues={issues ?? []}
      currentUserId={user.id}
    />
  )
}
