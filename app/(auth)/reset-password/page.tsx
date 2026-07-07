import { ResetPasswordForm } from './ResetPasswordForm'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'
import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <KanvixMark size={36} />
            <KanvixLogo width={160} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-lg">
          <h1 className="text-2xl font-700 text-foreground mb-2 text-center">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>
          <ResetPasswordForm />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link href="/login" className="text-primary hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
