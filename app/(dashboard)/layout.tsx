import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './DashboardShell'
import { getAlertsSummary } from '@/lib/alerts'
import type { Profile } from '@/lib/types'
import type { TeamOption, ArtisanOption } from '@/components/ui/AssignmentPicker'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = profileData as unknown as Profile | null
  const orgId = (profile as any)?.org_id as string | null

  const [projectsResult, alerts, artisansResult, teamsResult] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, color, status')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(10),
    orgId
      ? getAlertsSummary(supabase, orgId, user.id)
      : Promise.resolve({
          tasksLate: 0,
          tasksBlocked: 0,
          issuesCritical: 0,
          messagesRecent: 0,
          total: 0,
          items: [],
        }),
    orgId
      ? supabase
          .from('artisans')
          .select('id, full_name, trade, color')
          .eq('org_id', orgId)
          .eq('is_archived', false)
          .order('full_name')
      : Promise.resolve({ data: [] } as any),
    orgId
      ? supabase
          .from('teams')
          .select('id, name, color, type, members:team_members(artisan_id)')
          .eq('org_id', orgId)
          .order('name')
      : Promise.resolve({ data: [] } as any),
  ])

  const projects = (projectsResult.data ?? []) as unknown as {
    id: string
    name: string
    color: string
    status: string
  }[]

  const artisans = ((artisansResult.data ?? []) as ArtisanOption[])

  const teams = ((teamsResult.data ?? []) as Array<{
    id: string
    name: string
    color: string | null
    type: string | null
    members: { artisan_id: string }[]
  }>).map(t => ({
    id: t.id,
    name: t.name,
    color: t.color,
    type: t.type,
    memberCount: t.members?.length ?? 0,
  } satisfies TeamOption))

  return (
    <DashboardShell profile={profile} projects={projects} alerts={alerts} artisans={artisans} teams={teams}>
      {children}
    </DashboardShell>
  )
}
