'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface Props {
  token: string
  invitedEmail: string
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Lecteur',
}

export function InviteAcceptButton({ token, invitedEmail, role }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: rpcErr } = await (supabase as any).rpc('accept_invitation', { p_token: token })

    setLoading(false)

    if (rpcErr) { setError(rpcErr.message); return }

    const result = data as { success?: boolean; error?: string; role?: string; invited_email?: string }

    if (result?.error === 'email_mismatch') {
      setError(`Cette invitation est destinée à ${result.invited_email ?? invitedEmail}. Connectez-vous avec ce compte.`)
      return
    }
    if (result?.error === 'expired') {
      setError("Cette invitation a expiré. Demandez un nouveau lien à votre responsable.")
      return
    }
    if (result?.error === 'déjà_acceptée') {
      setError("Cette invitation a déjà été acceptée.")
      return
    }
    if (result?.error === 'revoked') {
      setError("Cette invitation a été révoquée.")
      return
    }
    if (result?.error) {
      setError(`Erreur : ${result.error}`)
      return
    }

    const targetRole = result?.role ?? role
    if (targetRole === 'artisan' || targetRole === 'site_supervisor') {
      router.push('/mobile')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={handleAccept} disabled={loading} className="w-full h-11 text-sm font-600">
        {loading ? 'Acceptation…' : `Rejoindre en tant que ${ROLE_LABEL[role] ?? role}`}
      </Button>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
