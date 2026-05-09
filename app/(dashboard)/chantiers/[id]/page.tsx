import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChantierDetail } from '@/components/chantiers/ChantierDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ChantierPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: project },
    { data: tasks },
    { data: issues },
    { data: photos },
    { data: documents },
    { data: messages },
    { data: materials },
    { data: deliveries },
    { data: reports },
    { data: logs },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*, assignee:artisans(id,full_name,color,trade), team:teams(id,name,color)').eq('project_id', id).order('position'),
    supabase.from('issues').select('*, artisan:artisans(full_name)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('photos').select('*, taken_by_profile:profiles!taken_by(full_name)').eq('project_id', id).order('taken_at', { ascending: false }).limit(20),
    supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('messages').select('*, sender:profiles!sender_id(full_name,avatar_url)').eq('project_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('materials').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('deliveries').select('*').eq('project_id', id).order('scheduled_date'),
    supabase.from('reports').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_logs').select('*, profile:profiles!user_id(full_name)').eq('project_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  if (!project) notFound()

  return (
    <ChantierDetail
      project={project}
      tasks={tasks ?? []}
      issues={issues ?? []}
      photos={photos ?? []}
      documents={documents ?? []}
      messages={messages ?? []}
      materials={materials ?? []}
      deliveries={deliveries ?? []}
      reports={reports ?? []}
      logs={logs ?? []}
    />
  )
}
