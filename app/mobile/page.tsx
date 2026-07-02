import { createClient } from '@/lib/supabase/server'
import { MobileArtisanView } from '@/components/mobile/MobileArtisanView'
import { redirect } from 'next/navigation'
import type { Profile, Artisan, Task, Message, Issue, Project } from '@/lib/types'

export default async function MobilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as unknown as Profile | null

  const orgId = profile?.org_id ?? null
  const isOwnerOrAdmin =
    profile?.role === 'owner' ||
    profile?.role === 'admin' ||
    profile?.role === 'manager' ||
    profile?.role === 'site_supervisor'
  const isField = profile?.role === 'artisan' || profile?.role === 'viewer'

  // Lookup artisan: prefer profile.artisan_id (set by invitation acceptance)
  // fallback to artisans.user_id = user.id (legacy / owner-linked artisan)
  const profileArtisanId = profile?.artisan_id ?? null
  const artisanQuery = profileArtisanId
    ? supabase.from('artisans').select('*').eq('id', profileArtisanId).eq('is_archived', false).single()
    : supabase.from('artisans').select('*').eq('user_id', user.id).eq('is_archived', false).single()
  const { data: artisanData } = await artisanQuery
  const artisan = artisanData as unknown as Artisan | null
  const artisanId = artisan?.id

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [tasksResult, doneTasksResult, messagesResult, issuesResult, projectsResult] = await Promise.all([
    artisanId
      ? supabase
          .from('tasks')
          .select('*, project:projects(id,name,color)')
          .eq('assigned_to', artisanId)
          .not('status', 'in', '(done,validated)')
          .order('end_date', { ascending: true, nullsFirst: false })
      : isOwnerOrAdmin && orgId
        ? supabase
            .from('tasks')
            .select('*, project:projects(id,name,color)')
            .eq('org_id', orgId)
            .not('status', 'in', '(done,validated)')
            .order('end_date', { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] }),

    // Tâches terminées aujourd'hui (completed_at >= début du jour)
    artisanId
      ? supabase
          .from('tasks')
          .select('*, project:projects(id,name,color)')
          .eq('assigned_to', artisanId)
          .eq('status', 'done')
          .gte('completed_at', todayStart.toISOString())
          .order('completed_at', { ascending: false })
      : isOwnerOrAdmin && orgId
        ? supabase
            .from('tasks')
            .select('*, project:projects(id,name,color)')
            .eq('org_id', orgId)
            .eq('status', 'done')
            .gte('completed_at', todayStart.toISOString())
            .order('completed_at', { ascending: false })
        : Promise.resolve({ data: [] }),

    orgId
      ? supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(full_name,avatar_url), project:projects(name,color)')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),

    orgId
      ? supabase
          .from('issues')
          .select('*, project:projects(id,name)')
          .eq('org_id', orgId)
          .eq('reported_by', user.id)
          .not('status', 'in', '(validated,rejected)')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    orgId
      ? supabase
          .from('projects')
          .select('id, org_id, name, color, status, progress, address')
          .eq('org_id', orgId)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const tasks = (tasksResult.data ?? []) as unknown as (Task & { project?: { id: string; name: string; color: string } | null })[]
  const doneTasks = (doneTasksResult.data ?? []) as unknown as (Task & { project?: { id: string; name: string; color: string } | null })[]
  const messages = (messagesResult.data ?? []) as unknown as (Message & { sender?: Profile | null; project?: { name: string; color: string } | null })[]
  const issues = (issuesResult.data ?? []) as unknown as (Issue & { project?: { id: string; name: string } | null })[]
  const projects = (projectsResult.data ?? []) as unknown as Pick<Project, 'id' | 'org_id' | 'name' | 'color' | 'status' | 'progress'>[]

  // Field user with no artisan link: flag for UI message
  const isUnlinkedField = isField && !artisanId

  return (
    <MobileArtisanView
      profile={profile}
      artisan={artisan}
      tasks={tasks}
      doneTasks={doneTasks}
      messages={messages}
      issues={issues}
      projects={projects}
      orgId={orgId}
      currentUserId={user.id}
      isUnlinkedField={isUnlinkedField}
    />
  )
}
