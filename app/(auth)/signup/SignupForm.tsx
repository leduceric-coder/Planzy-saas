'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SignupForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✉️</span>
        </div>
        <h2 className="text-lg font-700 text-foreground mb-2">Vérifiez vos emails</h2>
        <p className="text-sm text-muted-foreground">
          Un lien de confirmation a été envoyé à <strong>{email}</strong>.<br />
          Cliquez dessus pour activer votre compte.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignup} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-muted-foreground">Nom complet</label>
        <Input
          type="text"
          placeholder="Jean Dupont"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-muted-foreground">Email professionnel</label>
        <Input
          type="email"
          placeholder="jean@entreprise.fr"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-muted-foreground">Mot de passe</label>
        <Input
          type="password"
          placeholder="8 caractères minimum"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="h-11"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
        {loading ? 'Création...' : 'Créer mon compte'}
      </Button>

      <div className="text-center text-sm text-muted-foreground mt-2">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-primary font-600 hover:underline">
          Se connecter
        </Link>
      </div>
    </form>
  )
}
