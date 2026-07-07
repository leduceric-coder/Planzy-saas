import { UpdatePasswordForm } from './UpdatePasswordForm'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'

export default function UpdatePasswordPage() {
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
          <h1 className="text-2xl font-700 text-foreground mb-2 text-center">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Choisissez un nouveau mot de passe sécurisé pour votre compte.
          </p>
          <UpdatePasswordForm />
        </div>
      </div>
    </div>
  )
}
