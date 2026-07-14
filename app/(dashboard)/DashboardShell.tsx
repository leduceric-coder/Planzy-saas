'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemeProvider, useTheme } from '@/components/layout/ThemeProvider'
import { ToastProvider } from '@/components/ui/toast-context'
import { AlertsProvider } from '@/components/layout/AlertsContext'
import { RoleProvider } from '@/components/layout/RoleContext'
import { MessagesSideWindow } from '@/components/messages/MessagesSideWindow'
import { DemoGuide } from '@/components/demo/DemoGuide'
import type { Profile } from '@/lib/types'
import type { AlertsSummary } from '@/lib/alerts'
import type { TeamOption, ArtisanOption } from '@/components/ui/AssignmentPicker'

interface Props {
  children: React.ReactNode
  profile: Profile | null
  projects: { id: string; name: string; color: string }[]
  alerts: AlertsSummary
  artisans: ArtisanOption[]
  teams: TeamOption[]
}

function Shell({ children, profile, projects, alerts, artisans, teams }: Props) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const orgId = profile?.org_id ?? ''
  const currentUserId = profile?.id ?? ''

  return (
    <AlertsProvider value={alerts}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          profile={profile}
          onLogout={handleLogout}
          onThemeChange={setTheme}
          theme={theme}
          projects={projects}
          artisans={artisans}
          teams={teams}
          onOpenMessages={() => setMessagesOpen(true)}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {orgId && currentUserId && (
        <MessagesSideWindow
          isOpen={messagesOpen}
          onClose={() => setMessagesOpen(false)}
          orgId={orgId}
          currentUserId={currentUserId}
        />
      )}

      <DemoGuide
        isOpen={demoOpen}
        onOpen={() => setDemoOpen(true)}
        onClose={() => setDemoOpen(false)}
        onOpenMessages={() => setMessagesOpen(true)}
      />
    </AlertsProvider>
  )
}

export function DashboardShell(props: Props) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <RoleProvider role={(props.profile as { role?: string } | null)?.role}>
          <Shell {...props} />
        </RoleProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

