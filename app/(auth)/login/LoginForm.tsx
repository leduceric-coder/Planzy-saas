'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const passwordUpdated = searchParams.get('message') === 'password_updated'
  const prefillEmail = searchParams.get('email') ?? ''
  const redirectTo = searchParams.get('redirect') ?? '/'
  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message === 'Invalid login credentials') {
        setError('Email ou mot de passe incorrect. Vérifiez vos identifiants ou utilisez "Mot de passe oublié".')
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Email non confirmé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      {passwordUpdated && (
        <div className="text-sm text-green-700 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          Mot de passe mis à jour. Vous pouvez vous connecter.
        </div>
      )}

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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-600 text-muted-foreground">Mot de passe</label>
          <Link href="/reset-password" className="text-xs text-primary hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="h-11"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
        {loading ? 'Connexion...' : 'Se connecter'}
      </Button>

      <div className="text-center text-sm text-muted-foreground mt-2">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-primary font-600 hover:underline">
          Créer un compte
        </Link>
      </div>
    </form>
  )
}
