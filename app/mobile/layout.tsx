import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

export const metadata: Metadata = {
  title: 'Kanvix Terrain',
  description: 'Interface artisan — Mes tâches du jour',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">
        {children}
      </div>
    </ThemeProvider>
  )
}
