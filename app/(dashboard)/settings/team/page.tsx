import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { TeamClient } from '@/components/settings/TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, org_id, artisan_id')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    id: string
    email: string
    full_name: string | null
    role: string
    org_id: string | null
    artisan_id: string | null
  } | null

  if (!profile?.org_id) redirect('/settings')

  const orgId = profile.org_id

  const [{ data: membersRaw }, { data: invitationsRaw }, { data: artisansRaw }, { data: projectsRaw }, { data: tasksRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, artisan_id, created_at')
      .eq('org_id', orgId)
      .order('created_at'),
    supabase
      .from('invitations')
      .select('id, email, token, role, artisan_id, status, created_at, expires_at, email_sent_at, email_last_error, email_send_count, project_id, task_ids')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('artisans')
      .select('id, full_name, trade, user_id')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .order('full_name'),
    // Périmètre d'invitation artisan : chantiers + tâches de l'organisation.
    supabase
      .from('projects')
      .select('id, name')
      .eq('org_id', orgId)
      .neq('status', 'archived')
      .order('name'),
    supabase
      .from('tasks')
      .select('id, title, project_id')
      .eq('org_id', orgId)
      .not('status', 'in', '(done,validated)')
      .order('title'),
  ])

  const members = (membersRaw ?? []) as {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: string
    artisan_id: string | null
    created_at: string
  }[]

  const invitations = (invitationsRaw ?? []) as {
    id: string
    email: string
    token: string
    role: string
    artisan_id: string | null
    status: string
    created_at: string
    expires_at: string | null
    email_sent_at: string | null
    email_last_error: string | null
    email_send_count: number
    project_id: string | null
    task_ids: string[] | null
  }[]

  const artisans = (artisansRaw ?? []) as { id: string; full_name: string; trade: string; user_id: string | null }[]
  const projects = (projectsRaw ?? []) as { id: string; name: string }[]
  const tasks = (tasksRaw ?? []) as { id: string; title: string; project_id: string }[]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Membres & accès"
        subtitle={`${members.length} membre${members.length > 1 ? 's' : ''}`}
      />
      <div className="flex-1 overflow-y-auto px-10 pb-10">
        <TeamClient
          orgId={orgId}
          currentUserId={user.id}
          currentRole={profile.role}
          members={members}
          invitations={invitations}
          artisans={artisans}
          projects={projects}
          tasks={tasks}
        />
      </div>
    </div>
  )
}
