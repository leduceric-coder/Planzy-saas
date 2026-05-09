import { createClient } from '@/lib/supabase/server'
import { MessagesView } from '@/components/messages/MessagesView'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: threads } = await supabase
    .from('message_threads')
    .select('*, project:projects(id,name,color)')
    .eq('org_id', profile?.org_id)
    .order('created_at', { ascending: false })

  const { data: recentMessages } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(id,full_name,avatar_url)')
    .eq('org_id', profile?.org_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="flex h-full overflow-hidden">
      <MessagesView
        threads={threads ?? []}
        messages={recentMessages ?? []}
        currentUserId={user.id}
        profile={profile}
      />
    </div>
  )
}
