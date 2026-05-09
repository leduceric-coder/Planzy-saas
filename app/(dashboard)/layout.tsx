import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(10)

  return (
    <DashboardShell profile={profile} projects={projects ?? []}>
      {children}
    </DashboardShell>
  )
}
