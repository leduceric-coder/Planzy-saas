'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function UpdatePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré, recommencez depuis la page de connexion.')
      setLoading(false)
      return
    }

    // Sign out so middleware doesn't redirect away from /login success message
    await supabase.auth.signOut()
    router.push('/login?message=password_updated')
  }

  return (
    <form onSubmit={handleUpdate} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-muted-foreground">Nouveau mot de passe</label>
        <Input
          type="password"
          placeholder="8 caractères minimum"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-muted-foreground">Confirmer le mot de passe</label>
        <Input
          type="password"
          placeholder="Répétez le mot de passe"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
        {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
      </Button>
    </form>
  )
}
