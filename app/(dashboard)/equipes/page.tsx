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
    .select('org_id')
    .eq('id', user.id)
    .single()
  const orgId = (profileData as { org_id: string | null } | null)?.org_id

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [{ data: teamsData }, { data: artisansData }, { data: projectsData }, { data: tasksData }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, color, type, project_id, description, lead_id, project:projects(id,name), lead:artisans!lead_id(id,full_name,trade), members:team_members(artisan_id, artisan:artisans(id,full_name,trade,color))')
      .eq('org_id', orgId)
      .order('name'),
    supabase
      .from('artisans')
      .select('id, org_id, full_name, trade, color, phone, email, is_archived, status')
      .eq('org_id', orgId)
      .eq('is_archived', false)
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
  ])

  const teams    = (teamsData    ?? []) as unknown as TeamRow[]
  const artisans = (artisansData ?? []) as unknown as ArtisanRow[]
  const projects = (projectsData ?? []) as unknown as ProjectRow[]
  const tasks    = (tasksData    ?? []) as unknown as TaskWithProject[]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Équipes & terrain"
        subtitle="Suivez les affectations, disponibilités et conflits terrain."
        actions={
          <Link href="/equipes/nouveau-artisan">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouvel artisan
            </Button>
          </Link>
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
        />
      </div>
    </div>
  )
}
