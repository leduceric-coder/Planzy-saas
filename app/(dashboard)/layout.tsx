import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './DashboardShell'
import { AccessBlocked } from '@/components/layout/AccessBlocked'
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

  // LOT 41B/41E — Gate d'accès : un artisan suspendu/archivé ne peut pas entrer
  // dans l'application (gate applicatif ; la restriction DB complète = LOT 41D).
  // On résout le lien compte↔artisan par les DEUX chemins possibles
  // (profiles.artisan_id ET artisans.user_id) pour être robuste aux données
  // partiellement backfillées. Les rôles internes ne sont jamais bloqués ici.
  const internalRoles = ['owner', 'admin', 'manager', 'site_supervisor']
  const isInternal = internalRoles.includes(((profile as any)?.role as string) ?? '')
  if (!isInternal) {
    const artisanId = (profile as any)?.artisan_id as string | null
    const { data: linkedArtisan } = artisanId
      ? await supabase.from('artisans').select('status').eq('id', artisanId).maybeSingle()
      : await supabase.from('artisans').select('status').eq('user_id', user.id).maybeSingle()
    const artisanStatus = (linkedArtisan as { status?: string } | null)?.status
    if (artisanStatus === 'suspended' || artisanStatus === 'archived') {
      return <AccessBlocked status={artisanStatus} />
    }
  }

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

  // LOT 42E1C — périmètre d'ÉCRITURE de l'artisan, calculé ici une seule fois et
  // diffusé par contexte : les six écrans qui ouvrent TaskSidePanel n'ont ainsi
  // rien à câbler. Miroir exact de la règle RLS 42E1B (ATA active ∪ assigned_to),
  // à ne pas confondre avec les tâches simplement visibles. Rien n'est chargé
  // pour les rôles internes, qui peuvent tout éditer.
  const isArtisanRole = ((profile as any)?.role as string) === 'artisan'
  let artisanId: string | null = null
  let assignedTaskIds: string[] = []
  if (isArtisanRole && orgId) {
    artisanId = ((profile as any)?.artisan_id as string | null) ?? null
    if (!artisanId) {
      const { data: linked } = await supabase.from('artisans').select('id').eq('user_id', user.id).maybeSingle()
      artisanId = (linked as { id?: string } | null)?.id ?? null
    }
    if (artisanId) {
      const [{ data: ata }, { data: direct }] = await Promise.all([
        supabase.from('artisan_task_assignments').select('task_id').eq('artisan_id', artisanId).eq('is_active', true),
        supabase.from('tasks').select('id').eq('assigned_to', artisanId),
      ])
      assignedTaskIds = Array.from(new Set([
        ...((ata ?? []) as { task_id: string | null }[]).map(r => r.task_id).filter((v): v is string => !!v),
        ...((direct ?? []) as { id: string }[]).map(r => r.id),
      ]))
    }
  }

  return (
    <DashboardShell
      profile={profile}
      projects={projects}
      alerts={alerts}
      artisans={artisans}
      teams={teams}
      artisanId={artisanId}
      assignedTaskIds={assignedTaskIds}
    >
      {children}
    </DashboardShell>
  )
}
