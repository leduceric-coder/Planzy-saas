'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemeProvider, useTheme } from '@/components/layout/ThemeProvider'
import type { Profile } from '@/lib/types'

interface Props {
  children: React.ReactNode
  profile: Profile | null
  projects: { id: string; name: string; color: string }[]
}

function Shell({ children, profile, projects }: Props) {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        profile={profile}
        onLogout={handleLogout}
        onThemeToggle={toggleTheme}
        isDark={theme === 'dark'}
        projects={projects}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}

export function DashboardShell(props: Props) {
  return (
    <ThemeProvider>
      <Shell {...props} />
    </ThemeProvider>
  )
}
