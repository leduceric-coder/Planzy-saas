'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password`,
    })

    if (error) {
      if (error.status === 429) {
        setError('Trop de tentatives. Réessayez dans quelques minutes.')
      } else if (error.status === 0 || error.message.toLowerCase().includes('fetch')) {
        setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✉️</span>
        </div>
        <h2 className="text-lg font-700 text-foreground mb-2">Email envoyé</h2>
        <p className="text-sm text-muted-foreground">
          Si un compte existe avec <strong>{email}</strong>, vous recevrez un lien
          de réinitialisation dans quelques minutes.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleReset} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-muted-foreground">Email</label>
        <Input
          type="email"
          placeholder="vous@entreprise.fr"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="h-11"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
        {loading ? 'Envoi...' : 'Envoyer le lien'}
      </Button>

      <div className="text-center text-sm text-muted-foreground mt-2">
        <Link href="/login" className="text-primary font-600 hover:underline">
          Retour à la connexion
        </Link>
      </div>
    </form>
  )
}
