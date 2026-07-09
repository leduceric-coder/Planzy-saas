'use client'

// LOT 41B — Écran de blocage pour un artisan suspendu ou archivé.
// Gate APPLICATIF (rendu côté serveur dans le layout) : le Dashboard n'est pas
// rendu. Ne remplace pas la RLS (durcissement DB = LOT 41D) mais bloque l'accès
// à l'UII et permet la déconnexion. Aucune donnée n'est supprimée.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'
import { ShieldAlert, LogOut } from 'lucide-react'

export function AccessBlocked({ status }: { status: 'suspended' | 'archived' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const signOut = async () => {
    setLoading(true)
    await createClient().auth.signOut()
    router.push('/login')
  }

  const message =
    status === 'suspended'
      ? 'Votre accès Kanvix est suspendu. Contactez votre responsable.'
      : 'Votre accès Kanvix a été archivé. Contactez votre responsable.'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <KanvixMark size={36} />
            <KanvixLogo width={150} variant="auto" />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-lg flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-xl font-700 text-foreground">Accès indisponible</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          <button
            onClick={signOut}
            disabled={loading}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {loading ? '…' : 'Se déconnecter'}
          </button>
        </div>
      </div>
    </div>
  )
}
