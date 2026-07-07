import { createClient } from '@/lib/supabase/server'
import { MessagesView } from '@/components/messages/MessagesView'
import { signStoragePaths, resolveStorageUrl } from '@/lib/storage'
import type { Message, Profile } from '@/lib/types'

type ThreadRow = {
  id: string
  title: string | null
  type: string
  project?: { id: string; name: string; color: string } | null
  created_at: string
}

type ContextTask = { id: string; title: string; status: string; end_date: string | null; priority: string; project_id: string }
type ContextDoc = { id: string; name: string; file_type: string | null; created_at: string; project_id: string }
type ContextPhoto = { id: string; url: string; thumbnail_url: string | null; caption: string | null; created_at: string; project_id: string }
type ContextIssue = { id: string; title: string; status: string; priority: string; created_at: string; project_id: string }

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as unknown as Profile | null
  const orgId = profile?.org_id

  if (!orgId) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-2">Messages</h1>
        <p className="text-sm text-red-500">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  const [
    { data: threadsData },
    { data: recentMessagesData },
    { data: projectsData },
    { data: tasksData },
    { data: documentsData },
    { data: photosData },
    { data: issuesData },
  ] = await Promise.all([
    supabase
      .from('message_threads')
      .select('*, project:projects(id,name,color)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id,full_name,avatar_url)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('projects')
      .select('id, name, color')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('tasks')
      .select('id, title, status, end_date, priority, project_id')
      .eq('org_id', orgId)
      .not('status', 'in', '(done,validated,archived)')
      .order('end_date', { ascending: true })
      .limit(200),
    supabase
      .from('documents')
      .select('id, name, file_type, created_at, project_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('photos')
      .select('id, url, thumbnail_url, caption, created_at, project_id, storage_path')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('issues')
      .select('id, title, status, priority, created_at, project_id')
      .eq('org_id', orgId)
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const threads = (threadsData ?? []) as unknown as ThreadRow[]
  const recentMessages = (recentMessagesData ?? []) as unknown as (Message & { sender?: Profile | null })[]
  const projects = (projectsData ?? []) as { id: string; name: string; color: string }[]
  const contextTasks = (tasksData ?? []) as unknown as ContextTask[]
  const contextDocs = (documentsData ?? []) as unknown as ContextDoc[]
  const contextIssues = (issuesData ?? []) as unknown as ContextIssue[]

  // LOT 33 — signer les photos du panneau contextuel (bucket privé) : les uploads
  // réels stockent un chemin nu dans `url` → 404 sinon (même correctif que la fiche).
  const rawContextPhotos = (photosData ?? []) as unknown as (ContextPhoto & { storage_path?: string | null })[]
  const ctxPhotoSigned = await signStoragePaths(supabase, 'photos', rawContextPhotos.map(p => p.storage_path))
  const contextPhotos: ContextPhoto[] = rawContextPhotos.map(p =>
    p.storage_path
      ? { ...p, url: resolveStorageUrl(p.storage_path, ctxPhotoSigned, p.url) ?? '', thumbnail_url: null }
      : p
  )

  return (
    <div className="flex h-full overflow-hidden">
      <MessagesView
        threads={threads}
        messages={recentMessages}
        currentUserId={user.id}
        profile={profile}
        orgId={orgId}
        projects={projects}
        contextTasks={contextTasks}
        contextDocs={contextDocs}
        contextPhotos={contextPhotos}
        contextIssues={contextIssues}
      />
    </div>
  )
}
