import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { DocumentsClient } from '@/components/documents/DocumentsClient'

const SIGNED_URL_TTL = 3600

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const profile = profileData as unknown as { org_id: string | null } | null
  const orgId = profile?.org_id

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500">Impossible de charger votre organisation.</p>
      </div>
    )
  }

  const today = new Date().toISOString()

  const [
    { data: documentsRaw },
    { data: photosRaw },
    { data: projectsData },
    { data: issuesData },
  ] = await Promise.all([
    supabase.from('documents')
      .select('*, project:projects(name,color), uploader:profiles!uploaded_by(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase.from('photos')
      .select('*, project:projects(name,color)')
      .eq('org_id', orgId)
      .order('taken_at', { ascending: false })
      .limit(60),
    supabase.from('projects')
      .select('id, name, color')
      .eq('org_id', orgId)
      .neq('status', 'archived')
      .order('name'),
    supabase.from('issues')
      .select('id, status')
      .eq('org_id', orgId),
  ])

  const rawDocs   = (documentsRaw ?? []) as any[]
  const rawPhotos = (photosRaw   ?? []) as any[]
  const projects  = (projectsData ?? []) as { id: string; name: string; color: string | null }[]
  const issues    = (issuesData  ?? []) as { id: string; status: string }[]

  // Generate signed URLs for docs
  const docPaths = rawDocs
    .map((d, i) => ({ path: d.storage_path as string | null, index: i }))
    .filter(x => x.path)

  const photoPaths = rawPhotos
    .map((p, i) => ({ path: p.storage_path as string | null, index: i }))
    .filter(x => x.path)

  const [docSignedResult, photoSignedResult] = await Promise.all([
    docPaths.length > 0
      ? supabase.storage.from('documents').createSignedUrls(docPaths.map(x => x.path!), SIGNED_URL_TTL)
      : Promise.resolve({ data: null }),
    photoPaths.length > 0
      ? supabase.storage.from('photos').createSignedUrls(photoPaths.map(x => x.path!), SIGNED_URL_TTL)
      : Promise.resolve({ data: null }),
  ])

  const documents = rawDocs.map((d, i) => {
    const pathEntry = docPaths.find(x => x.index === i)
    if (pathEntry && docSignedResult.data) {
      const pos = docPaths.indexOf(pathEntry)
      const signedUrl = docSignedResult.data[pos]?.signedUrl
      if (signedUrl) return { ...d, file_url: signedUrl }
    }
    return d
  })

  const photos = rawPhotos.map((p, i) => {
    const pathEntry = photoPaths.find(x => x.index === i)
    if (pathEntry && photoSignedResult.data) {
      const pos = photoPaths.indexOf(pathEntry)
      const signedUrl = photoSignedResult.data[pos]?.signedUrl
      if (signedUrl) return { ...p, url: signedUrl }
    }
    return p
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Documents & photos"
        subtitle="Centralisez les preuves terrain, plans et validations."
      />
      <div className="flex-1 overflow-y-auto">
        <DocumentsClient
          orgId={orgId}
          documents={documents}
          photos={photos}
          projects={projects}
          issues={issues}
          today={today}
        />
      </div>
    </div>
  )
}
