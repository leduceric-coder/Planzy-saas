import { createClient } from '@/lib/supabase/server'
import { InviteAcceptButton } from '@/components/invite/InviteAcceptButton'
import { Building2, Shield, Clock } from 'lucide-react'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'
import Link from 'next/link'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Lecteur',
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  accepted: { label: 'Invitation déjà acceptée', color: 'text-green-500' },
  expired:  { label: 'Invitation expirée',         color: 'text-yellow-500' },
  revoked:  { label: 'Invitation révoquée',         color: 'text-destructive' },
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // get_invitation_by_token is SECURITY DEFINER — accessible sans auth
  const { data: inviteData } = await (supabase as any).rpc('get_invitation_by_token', { p_token: token })
  const invite = inviteData as {
    id: string
    email: string
    role: string
    org_id: string
    org_name: string
    artisan_id: string | null
    status: string
    expires_at: string | null
    created_at: string
  } | null

  const logoBox = (
    <div className="flex items-center justify-center gap-2 mb-8">
      <KanvixMark size={36} />
      <KanvixLogo width={120} />
    </div>
  )

  if (!invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center text-center">
          {logoBox}
          <Clock className="h-10 w-10 text-muted-foreground mb-4 opacity-40" />
          <h1 className="text-lg font-700 text-foreground mb-2">Invitation introuvable</h1>
          <p className="text-sm text-muted-foreground">Ce lien d'invitation n'existe pas ou a expiré. Demandez un nouveau lien à votre responsable.</p>
        </div>
      </div>
    )
  }

  const statusInfo = invite.status !== 'pending' ? STATUS_INFO[invite.status] : null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">
        {logoBox}

        <div className="text-center">
          <h1 className="text-xl font-700 text-foreground mb-2">Invitation à rejoindre</h1>
          <p className="text-sm text-muted-foreground">Vous avez été invité à rejoindre une organisation Kanvix</p>
        </div>

        {/* Org card */}
        <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-600 text-foreground">{invite.org_name}</p>
              <p className="text-xs text-muted-foreground">Organisation</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
            <div>
              <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground mb-0.5">Rôle assigné</p>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-600 text-foreground">{ROLE_LABEL[invite.role] ?? invite.role}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground mb-0.5">Email invité</p>
              <p className="text-sm text-foreground truncate">{invite.email}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        {statusInfo ? (
          <div className={`text-sm font-600 text-center ${statusInfo.color}`}>
            {statusInfo.label}
          </div>
        ) : user ? (
          /* Utilisateur connecté — bouton accept */
          <div className="flex flex-col gap-3">
            {user.email !== invite.email && (
              <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                Vous êtes connecté avec <strong>{user.email}</strong>. Cette invitation est destinée à <strong>{invite.email}</strong>.
              </div>
            )}
            <InviteAcceptButton token={token} invitedEmail={invite.email} role={invite.role} />
          </div>
        ) : (
          /* Utilisateur non connecté */
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground text-center">
              Connectez-vous ou créez un compte avec <strong>{invite.email}</strong> pour accepter l'invitation.
            </p>
            <Link
              href={`/signup?email=${encodeURIComponent(invite.email)}&redirect=/invite/${token}`}
              className="w-full flex items-center justify-center h-11 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              Créer mon compte
            </Link>
            <Link
              href={`/login?email=${encodeURIComponent(invite.email)}&redirect=/invite/${token}`}
              className="w-full flex items-center justify-center h-11 rounded-xl border border-border text-foreground text-sm font-500 hover:bg-elevated transition-colors"
            >
              J'ai déjà un compte
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
