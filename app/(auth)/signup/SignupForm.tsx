'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SignupForm() {
  const searchParams = useSearchParams()
  const prefillEmail = searchParams.get('email') ?? ''
  const redirectTo = searchParams.get('redirect') ?? '/'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyExists, setAlreadyExists] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate env vars — NEXT_PUBLIC_ vars are safe to inspect client-side
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

    if (!supabaseUrl || !anonKey) {
      console.error('[Planzy] Supabase env vars missing — URL present:', !!supabaseUrl, '/ ANON_KEY present:', !!anonKey)
      setError('Configuration manquante. Contactez le support.')
      setLoading(false)
      return
    }

    try {
      const parsed = new URL(supabaseUrl)
      if (parsed.pathname !== '/') {
        throw new Error(`Chemin inattendu dans NEXT_PUBLIC_SUPABASE_URL: "${parsed.pathname}" — doit être "/"`)
      }
      console.log('[Planzy] Supabase hostname:', parsed.hostname)
    } catch (err) {
      console.error('[Planzy] NEXT_PUBLIC_SUPABASE_URL invalide:', err instanceof Error ? err.message : err)
      setError('URL Supabase mal configurée. Vérifiez NEXT_PUBLIC_SUPABASE_URL dans Vercel.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    if (error) {
      console.error('[Planzy] signUp error:', error.status, error.message)
      if (error.message.toLowerCase().includes('invalid') && error.message.toLowerCase().includes('path')) {
        setError('URL Supabase incorrecte (chemin invalide). Vérifiez NEXT_PUBLIC_SUPABASE_URL dans Vercel.')
      } else if (error.status === 422 || error.message.toLowerCase().includes('already registered')) {
        setError('Cette adresse email est déjà utilisée.')
      } else if (error.status === 429) {
        setError('Trop de tentatives. Réessayez dans quelques minutes.')
      } else if (error.status === 0 || error.message.toLowerCase().includes('fetch')) {
        setError('Impossible de joindre le serveur d\'authentification. Vérifiez votre connexion.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    // Supabase returns a fake success (identities: []) for already-confirmed emails
    // to prevent email enumeration — detect it and redirect to login
    if (data.user?.identities?.length === 0) {
      setAlreadyExists(true)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (alreadyExists) {
    const loginHref = `/login?email=${encodeURIComponent(email)}${redirectTo !== '/' ? `&redirect=${encodeURIComponent(redirectTo)}` : ''}`
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">👤</span>
        </div>
        <h2 className="text-lg font-700 text-foreground mb-2">Compte déjà existant</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Un compte existe déjà avec <strong>{email}</strong>.<br />
          Connectez-vous pour continuer.
        </p>
        <Link href={loginHref} className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors w-full">
          Se connecter
        </Link>
      </div>
    )
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
          Cliquez dessus pour activer votre compte
          {redirectTo !== '/' ? ' et rejoindre votre organisation.' : '.'}
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
