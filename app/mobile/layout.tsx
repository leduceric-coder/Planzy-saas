import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planzy Terrain',
  description: 'Interface artisan — Mes tâches du jour',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">
      {children}
    </div>
  )
}
