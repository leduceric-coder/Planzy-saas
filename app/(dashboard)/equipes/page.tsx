import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EquipesClient } from '@/components/equipes/EquipesClient'
import type { TeamType } from '@/components/equipes/TeamSlidePanel'
import type { TaskWithProject } from '@/components/equipes/ArtisanSidePanel'

type TeamMember = {
  artisan_id: string | null
  artisan: {
    id: string
    full_name: string | null
    trade: string | null
    color: string | null
  } | null
}

type TeamRow = {
  id: string
  name: string | null
  color: string | null
  type: TeamType | null
  project_id: string | null
  description: string | null
  lead_id: string | null
  project: { id: string; name: string } | null
  lead: { id: string; full_name: string | null; trade: string | null } | null
  members: TeamMember[]
}

type ArtisanRow = {
  id: string
  org_id: string
  full_name: string | null
  trade: string | null
  color: string | null
  phone: string | null
  email: string | null
  is_archived: boolean
  status?: string | null
  user_id?: string | null
}

type ProjectRow = {
  id: string
  name: string
  color: string | null
}

export default async function EquipesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()
  const orgId = (profileData as { org_id: string | null } | null)?.org_id
  const role = (profileData as { role: string | null } | null)?.role ?? null
  // Rôles internes autorisés à gérer les artisans (statuts + rattachements).
  const canManage = ['owner', 'admin', 'manager', 'site_supervisor'].includes(role ?? '')
  // Inviter / relancer / révoquer : owner/admin uniquement (aligné RLS invitations + API /send).
  const canInvite = ['owner', 'admin'].includes(role ?? '')

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [{ data: teamsData }, { data: artisansData }, { data: projectsData }, { data: tasksData }, { data: invitesData }, { data: apaData }, { data: ataData }, { data: accountsData }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, color, type, project_id, description, lead_id, project:projects(id,name), lead:artisans!lead_id(id,full_name,trade), members:team_members(artisan_id, artisan:artisans(id,full_name,trade,color))')
      .eq('org_id', orgId)
      .order('name'),
    // Tous les artisans (actifs, suspendus, archivés) : le filtre cycle de vie
    // est appliqué côté client pour rester accessibles via l'onglet « Archivés ».
    supabase
      .from('artisans')
      .select('id, org_id, full_name, trade, color, phone, email, is_archived, status, user_id')
      .eq('org_id', orgId)
      .order('full_name'),
    supabase
      .from('projects')
      .select('id, name, color')
      .eq('org_id', orgId)
      .neq('status', 'archived')
      .order('name'),
    supabase
      .from('tasks')
      .select('id, project_id, title, status, start_date, end_date, assigned_to, assigned_team')
      .eq('org_id', orgId)
      .not('status', 'in', '(done,validated)'),
    // Invitations en attente → « Invitation en attente » + périmètre prévu (fiche).
    supabase
      .from('invitations')
      .select('id, email, role, artisan_id, status, project_id, task_ids')
      .eq('org_id', orgId)
      .eq('status', 'pending'),
    // Rattachements actifs → source de vérité des badges « Sans chantier / tâche »
    // (carte + fiche). RLS org-scoped ; comptage côté serveur.
    supabase
      .from('artisan_project_assignments')
      .select('artisan_id')
      .eq('org_id', orgId)
      .eq('is_active', true),
    supabase
      .from('artisan_task_assignments')
      .select('artisan_id')
      .eq('org_id', orgId)
      .eq('is_active', true),
    // Comptes liés → rôle/email du compte Kanvix par artisan (fiche ressource).
    supabase
      .from('profiles')
      .select('artisan_id, role, email')
      .eq('org_id', orgId)
      .not('artisan_id', 'is', null),
  ])

  const teams    = (teamsData    ?? []) as unknown as TeamRow[]
  const artisans = (artisansData ?? []) as unknown as ArtisanRow[]
  const projects = (projectsData ?? []) as unknown as ProjectRow[]
  const tasks    = (tasksData    ?? []) as unknown as TaskWithProject[]
  const pendingInvites = (invitesData ?? []) as { id: string; email: string | null; role: string | null; artisan_id: string | null; project_id: string | null; task_ids: string[] | null }[]
  const pendingInviteArtisanIds = Array.from(new Set(
    pendingInvites.map(i => i.artisan_id).filter((v): v is string => !!v)
  ))
  // Invitation en attente par artisan (id/email/rôle + périmètre prévu) : alimente
  // la fiche ressource pour relancer/révoquer et afficher le périmètre.
  const pendingInviteScopes: Record<string, { id: string; email: string | null; role: string | null; projectId: string | null; taskIds: string[] }> = {}
  for (const i of pendingInvites) {
    if (!i.artisan_id) continue
    if (!pendingInviteScopes[i.artisan_id]) {
      pendingInviteScopes[i.artisan_id] = { id: i.id, email: i.email, role: i.role, projectId: i.project_id, taskIds: i.task_ids ?? [] }
    }
  }

  // Compte Kanvix lié par artisan (rôle applicatif + email).
  const accountByArtisan: Record<string, { role: string | null; email: string | null }> = {}
  for (const a of (accountsData ?? []) as { artisan_id: string | null; role: string | null; email: string | null }[]) {
    if (a.artisan_id && !accountByArtisan[a.artisan_id]) accountByArtisan[a.artisan_id] = { role: a.role, email: a.email }
  }

  const assignmentCounts: Record<string, { projects: number; tasks: number }> = {}
  for (const r of (apaData ?? []) as { artisan_id: string | null }[]) {
    if (!r.artisan_id) continue
    ;(assignmentCounts[r.artisan_id] ??= { projects: 0, tasks: 0 }).projects++
  }
  for (const r of (ataData ?? []) as { artisan_id: string | null }[]) {
    if (!r.artisan_id) continue
    ;(assignmentCounts[r.artisan_id] ??= { projects: 0, tasks: 0 }).tasks++
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Ressources"
        subtitle="Pilotez les artisans, équipes et accès chantier."
        actions={
          canManage ? (
            <Link href="/equipes/nouveau-artisan">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Nouvel artisan
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto">
        <EquipesClient
          teams={teams}
          artisans={artisans}
          projects={projects}
          orgId={orgId}
          tasks={tasks}
          today={today}
          canManage={canManage}
          canInvite={canInvite}
          currentUserId={user.id}
          pendingInviteArtisanIds={pendingInviteArtisanIds}
          pendingInviteScopes={pendingInviteScopes}
          assignmentCounts={assignmentCounts}
          accountByArtisan={accountByArtisan}
        />
      </div>
    </div>
  )
}
