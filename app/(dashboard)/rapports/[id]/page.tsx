import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RapportView } from '@/components/rapports/RapportView'

interface Props {
  params: Promise<{ id: string }>
}

const SIGNED_URL_TTL = 3600

export default async function RapportPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const orgId = (profileData as any)?.org_id as string | null
  if (!orgId) notFound()

  // Fetch report — RLS ensures it belongs to the user's org
  const { data: reportRaw } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!reportRaw) notFound()

  const report = reportRaw as any

  // Global/monthly reports with no project redirect to the global view
  if (!report.project_id) redirect('/rapports/global')

  const content = report.content as {
    period_start?: string
    period_end?: string
    period_label?: string
    include_photos?: boolean
    include_issues?: boolean
    include_messages?: boolean
  } | null

  // Fetch project
  const { data: projectRaw } = await supabase
    .from('projects')
    .select('id, name, address, description, status, start_date, end_date, progress, color')
    .eq('id', report.project_id)
    .eq('org_id', orgId)
    .single()

  if (!projectRaw) notFound()

  // Parallel data fetches
  const [
    { data: tasksRaw },
    { data: issuesRaw },
    { data: photosRaw },
    { data: messagesRaw },
    { data: authorRaw },
  ] = await Promise.all([
    // All tasks for the project (categorized by status in RapportView)
    supabase
      .from('tasks')
      .select('id, title, status, start_date, end_date, priority, description, assigned_to, assignee:artisans!assigned_to(full_name, color)')
      .eq('project_id', report.project_id)
      .eq('org_id', orgId)
      .order('position', { ascending: true }),

    // Issues — only when include_issues is not explicitly false
    content?.include_issues !== false
      ? supabase
          .from('issues')
          .select('id, title, description, status, priority, assigned_to, assignee:artisans!assigned_to(full_name)')
          .eq('project_id', report.project_id)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any }),

    // Photos — most recent 12, filtered by period if available
    content?.include_photos !== false
      ? (() => {
          let q = supabase
            .from('photos')
            .select('id, url, storage_path, caption, theme, taken_at')
            .eq('project_id', report.project_id)
            .eq('org_id', orgId)
            .order('taken_at', { ascending: false })
            .limit(12)
          if (content?.period_start) q = q.gte('taken_at', content.period_start) as any
          if (content?.period_end) q = q.lte('taken_at', content.period_end + 'T23:59:59') as any
          return q
        })()
      : Promise.resolve({ data: [] as any }),

    // Messages
    content?.include_messages
      ? supabase
          .from('messages')
          .select('id, content, type, created_at, sender:profiles!sender_id(full_name)')
          .eq('project_id', report.project_id)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as any }),

    // Author profile
    report.generated_by
      ? supabase.from('profiles').select('full_name').eq('id', report.generated_by).single()
      : Promise.resolve({ data: null as any }),
  ])

  // Generate signed URLs for photos
  const photos = (photosRaw ?? []) as any[]
  const photosWithUrls = await (async () => {
    const paths = photos.filter((p: any) => p.storage_path).map((p: any) => p.storage_path as string)
    if (paths.length === 0) return photos.map((p: any) => ({ ...p, signedUrl: p.url }))

    const { data: signed } = await supabase.storage
      .from('photos')
      .createSignedUrls(paths, SIGNED_URL_TTL)

    return photos.map((p: any) => {
      const idx = paths.indexOf(p.storage_path)
      return { ...p, signedUrl: idx >= 0 ? (signed?.[idx]?.signedUrl ?? p.url) : p.url }
    })
  })()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RapportView
        report={{
          id: report.id,
          title: report.title,
          type: report.type ?? null,
          created_at: report.created_at ?? null,
          content: content ?? null,
        }}
        project={projectRaw as any}
        tasks={(tasksRaw ?? []) as any[]}
        issues={(issuesRaw ?? []) as any[]}
        photos={photosWithUrls}
        messages={(messagesRaw ?? []) as any[]}
        author={(authorRaw as any) ?? null}
      />
    </div>
  )
}
