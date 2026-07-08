import { Suspense } from 'react'
import Link from 'next/link'
import { SignupForm } from './SignupForm'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md animate-fade-up">
        {/* Logo — retour à la landing publique */}
        <div className="flex justify-center mb-8">
          <Link href="/landing" aria-label="Accueil Kanvix" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <KanvixMark size={36} />
            <KanvixLogo width={160} />
          </Link>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-lg">
          <h1 className="text-2xl font-700 text-foreground mb-2 text-center">Créer un compte</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Démarrez gratuitement. Aucune carte bancaire requise.
          </p>
          <Suspense>
            <SignupForm />
          </Suspense>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link href="/landing" className="text-primary font-600 hover:underline">Découvrir Kanvix</Link>
          {' · '}
          Plateforme BTP professionnelle
        </p>
      </div>
    </div>
  )
}
