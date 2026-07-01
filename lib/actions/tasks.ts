'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Task, TaskStatus } from '@/lib/types'

export type TaskWithRelations = Task & {
  assignee?: { id: string; full_name: string; color: string; trade: string } | null
  team?: { id: string; name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

export interface TaskFormInput {
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  start_date: string | null
  end_date: string | null
  assigned_to: string | null
  assigned_team: string | null
}

interface ActionResult<T> {
  data?: T
  error?: string
}

const TASK_SELECT = '*, assignee:artisans(id,full_name,color,trade), team:teams(id,name,color), project:projects(id,name,color)'

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function requireOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ orgId: string | null; userId: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orgId: null, userId: null, error: 'Vous devez être connecté pour effectuer cette action.' }

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile?.org_id) return { orgId: null, userId: user.id, error: "Votre compte n'est rattaché à aucune organisation." }

  return { orgId: profile.org_id, userId: user.id, error: null }
}

function validateInput(input: TaskFormInput): string | null {
  if (!input.title?.trim()) return 'Le nom de la tâche est obligatoire.'
  if (!input.project_id) return 'Le chantier est obligatoire.'
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return 'La date de fin doit être égale ou postérieure à la date de début.'
  }
  if (input.assigned_to && input.assigned_team) {
    return 'Choisissez soit un artisan, soit une équipe, pas les deux à la fois.'
  }
  return null
}

async function assertBelongsToOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'projects' | 'artisans' | 'teams',
  id: string,
  orgId: string,
  notFoundMessage: string
): Promise<string | null> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('org_id', orgId).single()
  if (!data) return notFoundMessage
  return null
}

function revalidateTaskPaths(projectIds: string[]) {
  revalidatePath('/planning')
  for (const id of new Set(projectIds)) {
    revalidatePath(`/chantiers/${id}`)
  }
}

export async function createTask(input: TaskFormInput): Promise<ActionResult<TaskWithRelations>> {
  const supabase = await createClient()
  const { orgId, userId, error: orgError } = await requireOrgId(supabase)
  if (!orgId || !userId) return { error: orgError! }

  const validationError = validateInput(input)
  if (validationError) return { error: validationError }

  const projectError = await assertBelongsToOrg(supabase, 'projects', input.project_id, orgId, "Le chantier sélectionné est introuvable.")
  if (projectError) return { error: projectError }

  if (input.assigned_to) {
    const artisanError = await assertBelongsToOrg(supabase, 'artisans', input.assigned_to, orgId, "L'artisan sélectionné est introuvable.")
    if (artisanError) return { error: artisanError }
  }
  if (input.assigned_team) {
    const teamError = await assertBelongsToOrg(supabase, 'teams', input.assigned_team, orgId, "L'équipe sélectionnée est introuvable.")
    if (teamError) return { error: teamError }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: input.project_id,
      org_id: orgId,
      title: input.title.trim(),
      description: cleanText(input.description),
      status: input.status,
      priority: input.priority,
      start_date: input.start_date,
      end_date: input.end_date,
      assigned_to: input.assigned_to,
      assigned_team: input.assigned_team,
      created_by: userId,
      position: 0,
      estimated_hours: null,
      actual_hours: null,
      parent_task_id: null,
    })
    .select(TASK_SELECT)
    .single()

  if (error || !data) {
    return { error: "La création de la tâche a échoué. Vous n'avez peut-être pas les droits nécessaires." }
  }

  revalidateTaskPaths([input.project_id])
  return { data: data as unknown as TaskWithRelations }
}

export async function updateTask(taskId: string, input: Partial<TaskFormInput>): Promise<ActionResult<TaskWithRelations>> {
  const supabase = await createClient()
  const { orgId, error: orgError } = await requireOrgId(supabase)
  if (!orgId) return { error: orgError! }

  const { data: existing } = await supabase.from('tasks').select('*').eq('id', taskId).eq('org_id', orgId).single()
  if (!existing) return { error: 'Tâche introuvable, ou vous ne disposez pas des droits pour la consulter.' }

  const merged: TaskFormInput = {
    project_id: input.project_id ?? existing.project_id,
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    status: input.status ?? existing.status,
    priority: input.priority ?? existing.priority,
    start_date: input.start_date !== undefined ? input.start_date : existing.start_date,
    end_date: input.end_date !== undefined ? input.end_date : existing.end_date,
    assigned_to: input.assigned_to !== undefined ? input.assigned_to : existing.assigned_to,
    assigned_team: input.assigned_team !== undefined ? input.assigned_team : existing.assigned_team,
  }

  const validationError = validateInput(merged)
  if (validationError) return { error: validationError }

  if (merged.project_id !== existing.project_id) {
    const projectError = await assertBelongsToOrg(supabase, 'projects', merged.project_id, orgId, "Le chantier sélectionné est introuvable.")
    if (projectError) return { error: projectError }
  }
  if (merged.assigned_to) {
    const artisanError = await assertBelongsToOrg(supabase, 'artisans', merged.assigned_to, orgId, "L'artisan sélectionné est introuvable.")
    if (artisanError) return { error: artisanError }
  }
  if (merged.assigned_team) {
    const teamError = await assertBelongsToOrg(supabase, 'teams', merged.assigned_team, orgId, "L'équipe sélectionnée est introuvable.")
    if (teamError) return { error: teamError }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({
      project_id: merged.project_id,
      title: merged.title.trim(),
      description: cleanText(merged.description),
      status: merged.status,
      priority: merged.priority,
      start_date: merged.start_date,
      end_date: merged.end_date,
      assigned_to: merged.assigned_to,
      assigned_team: merged.assigned_team,
    })
    .eq('id', taskId)
    .eq('org_id', orgId)
    .select(TASK_SELECT)
    .single()

  if (error || !data) {
    return { error: "La modification a échoué. Vous n'avez peut-être pas les droits nécessaires." }
  }

  revalidateTaskPaths([merged.project_id, existing.project_id])
  return { data: data as unknown as TaskWithRelations }
}

export interface ArtisanConflict {
  taskId: string
  taskTitle: string
  projectName: string
  startDate: string
  endDate: string
}

/**
 * Chevauchement de dates (inclusif) entre la période demandée et les tâches
 * déjà affectées à l'artisan. Utilisé pour avertir l'utilisateur — ne bloque
 * jamais l'enregistrement.
 */
export async function checkArtisanConflicts(
  artisanId: string,
  startDate: string,
  endDate: string,
  excludeTaskId?: string
): Promise<ArtisanConflict[]> {
  if (!artisanId || !startDate || !endDate) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('tasks')
    .select('id, title, start_date, end_date, project:projects(name)')
    .eq('assigned_to', artisanId)
    .not('start_date', 'is', null)
    .not('end_date', 'is', null)
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (excludeTaskId) {
    query = query.neq('id', excludeTaskId)
  }

  const { data } = await query
  if (!data) return []

  return data.map((t) => ({
    taskId: t.id,
    taskTitle: t.title,
    projectName: t.project?.name ?? 'chantier inconnu',
    startDate: t.start_date,
    endDate: t.end_date,
  }))
}
