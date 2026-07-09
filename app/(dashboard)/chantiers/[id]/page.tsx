import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChantierDetail } from '@/components/chantiers/ChantierDetail'
import { signStoragePaths, resolveStorageUrl } from '@/lib/storage'
import type { Project, Task, Issue, Photo, Document, Message, Material, Delivery, Report, ActivityLog } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ focus?: string; id?: string }>
}

export default async function ChantierPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id ?? ''

  const [
    { data: projectData },
    { data: tasksData },
    { data: issuesData },
    { data: photosData },
    { data: documentsData },
    { data: messagesData },
    { data: materialsData },
    { data: deliveriesData },
    { data: reportsData },
    { data: logsData },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*, assignee:artisans(id,full_name,color,trade), team:teams(id,name,color)').eq('project_id', id).order('position'),
    supabase.from('issues').select('*, artisan:artisans!assigned_to(id,full_name,color)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('photos').select('*, taken_by_profile:profiles!taken_by(full_name), task:tasks!task_id(id, title)').eq('project_id', id).order('taken_at', { ascending: false }).limit(20),
    supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('messages').select('*, sender:profiles!sender_id(full_name,avatar_url)').eq('project_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('materials').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('deliveries').select('*').eq('project_id', id).order('scheduled_date'),
    supabase.from('reports').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_logs').select('*, profile:profiles!user_id(full_name)').eq('project_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  const project = projectData as Project | null
  if (!project) return notFound()

  // LOT 33 — Bucket Storage privé : signer les chemins des photos/documents.
  // Les uploads réels stockent un chemin nu dans url/file_url ; on le remplace
  // par une URL signée (fraîche à chaque rendu serveur). Les anciennes données
  // (url http complète, storage_path null) sont conservées telles quelles ;
  // les photos DEMO (placeholder / caption) restent gérées côté client.
  const rawPhotos = (photosData ?? []) as unknown as (Photo & { taken_by_profile?: any; storage_path?: string | null })[]
  const rawDocuments = (documentsData ?? []) as unknown as (Document & { storage_path?: string | null })[]

  const [photoSigned, docSigned] = await Promise.all([
    signStoragePaths(supabase, 'photos', rawPhotos.map(p => p.storage_path)),
    signStoragePaths(supabase, 'documents', rawDocuments.map(d => d.storage_path)),
  ])

  const photos = rawPhotos.map(p =>
    p.storage_path ? { ...p, url: photoSigned.get(p.storage_path) ?? null, thumbnail_url: null } : p
  )
  const documents = rawDocuments.map(d =>
    ({ ...d, file_url: resolveStorageUrl(d.storage_path, docSigned, d.file_url) ?? '' })
  )

  // Fetch artisans, all org teams (for assignment picker), and project-associated teams
  const [{ data: artisansData }, { data: teamsData }, { data: projectTeamsData }] = await Promise.all([
    supabase
      .from('artisans')
      .select('id, full_name, trade, color')
      .eq('org_id', project.org_id)
      .eq('is_archived', false)
      .order('full_name'),
    supabase
      .from('teams')
      .select('id, name, color, type, members:team_members(artisan_id)')
      .eq('org_id', project.org_id)
      .order('name'),
    supabase
      .from('teams')
      .select('id, name, color, type, members:team_members(artisan_id)')
      .eq('project_id', id)
      .order('name'),
  ])

  const teams = ((teamsData ?? []) as Array<{
    id: string; name: string; color: string | null; type: string | null
    members: { artisan_id: string }[]
  }>).map(t => ({
    id: t.id, name: t.name, color: t.color, type: t.type,
    memberCount: t.members?.length ?? 0,
  }))

  const projectTeams = ((projectTeamsData ?? []) as Array<{
    id: string; name: string; color: string | null; type: string | null
    members: { artisan_id: string }[]
  }>).map(t => ({
    id: t.id, name: t.name, color: t.color, type: t.type,
    memberCount: t.members?.length ?? 0,
  }))

  return (
    <ChantierDetail
      project={project as Project}
      tasks={(tasksData ?? []) as unknown as (Task & { assignee?: any; team?: any })[]}
      issues={(issuesData ?? []) as unknown as (Issue & { artisan?: any })[]}
      photos={photos as unknown as (Photo & { taken_by_profile?: any })[]}
      documents={documents as unknown as Document[]}
      messages={(messagesData ?? []) as unknown as (Message & { sender?: any })[]}
      materials={(materialsData ?? []) as unknown as Material[]}
      deliveries={(deliveriesData ?? []) as unknown as Delivery[]}
      reports={(reportsData ?? []) as unknown as Report[]}
      logs={(logsData ?? []) as unknown as (ActivityLog & { profile?: any })[]}
      artisans={(artisansData ?? []) as unknown as { id: string; full_name: string | null; trade: string | null; color: string | null }[]}
      teams={teams}
      projectTeams={projectTeams}
      currentUserId={currentUserId}
      focus={sp.focus === 'task' || sp.focus === 'issue' ? sp.focus : undefined}
      focusId={sp.id}
    />
  )
}
