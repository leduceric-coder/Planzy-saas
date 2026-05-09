import { SignupForm } from './SignupForm'
import { Zap } from 'lucide-react'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-700 tracking-tight text-foreground">Planzy</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 shadow-lg">
          <h1 className="text-2xl font-700 text-foreground mb-2 text-center">Créer un compte</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Démarrez gratuitement. Aucune carte bancaire requise.
          </p>
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
