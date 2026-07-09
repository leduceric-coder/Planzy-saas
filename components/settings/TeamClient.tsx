'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Mail, Shield, Link2, Copy, Check, Pencil, UserMinus, UserPlus, Trash2,
  AlertTriangle, Send, RefreshCw, CheckCircle, XCircle, Clock,
} from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast-context'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  artisan_id: string | null
  created_at: string
}

interface Invitation {
  id: string
  email: string
  token: string
  role: string
  artisan_id: string | null
  status: string
  created_at: string
  expires_at: string | null
  email_sent_at: string | null
  email_last_error: string | null
  email_send_count: number
}

interface Artisan {
  id: string
  full_name: string
  trade: string
  user_id: string | null
}

interface Props {
  orgId: string
  currentUserId: string
  currentRole: string
  members: Member[]
  invitations: Invitation[]
  artisans: Artisan[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Lecteur',
}

const ROLE_COLOR: Record<string, string> = {
  owner: 'bg-primary/15 text-primary',
  admin: 'bg-violet-500/15 text-violet-500',
  manager: 'bg-blue-500/15 text-blue-500',
  site_supervisor: 'bg-cyan-500/15 text-cyan-500',
  artisan: 'bg-orange-500/15 text-orange-500',
  viewer: 'bg-muted text-muted-foreground',
}

const INVITE_ROLES = ['admin', 'manager', 'site_supervisor', 'artisan', 'viewer'] as const

const EDIT_ERROR_MESSAGES: Record<string, string> = {
  'non_autorisé': 'Action non autorisée.',
  'seul_owner_peut_promouvoir': 'Seul un propriétaire peut attribuer le rôle Propriétaire.',
  'dernier_owner': "Impossible : cet utilisateur est le dernier propriétaire de l'organisation.",
  'artisan_autre_org': "Cet artisan n'appartient pas à votre organisation.",
  'artisan_deja_lie': 'Cet artisan est déjà rattaché à un autre utilisateur.',
  'cannot_remove_self': 'Vous ne pouvez pas vous retirer vous-même.',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn('text-xs font-600 px-2 py-0.5 rounded-full shrink-0', ROLE_COLOR[role] ?? 'bg-muted text-muted-foreground')}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

function SelectField({
  label, value, onChange, children, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-600 text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-60"
      >
        {children}
      </select>
    </div>
  )
}

function EmailStatusBadge({ inv }: { inv: Invitation }) {
  if (inv.email_sent_at) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-green-500 font-500">
        <CheckCircle className="h-3 w-3 shrink-0" />
        <span>Envoyé {formatDate(inv.email_sent_at)}</span>
      </div>
    )
  }
  if (inv.email_last_error) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-destructive font-500">
        <XCircle className="h-3 w-3 shrink-0" />
        <span>Erreur d&apos;envoi</span>
      </div>
    )
  }
  if (inv.email_send_count === 0) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-500">
        <Clock className="h-3 w-3 shrink-0" />
        <span>Non envoyé</span>
      </div>
    )
  }
  return null
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamClient({ orgId, currentUserId, currentRole, members, invitations: initialInvitations, artisans }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = currentRole === 'owner' || currentRole === 'admin'

  // ── Invite form ──────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('artisan')
  const [artisanId, setArtisanId] = useState('')
  const [sending, setSending] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations)

  // ── Edit member dialog ────────────────────────────────────────────────────────
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editRole, setEditRole] = useState<string>('viewer')
  const [editArtisanId, setEditArtisanId] = useState<string>('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // ── Remove confirmation ───────────────────────────────────────────────────────
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<Member | null>(null)
  const [removeSaving, setRemoveSaving] = useState(false)

  // ── Resend email ─────────────────────────────────────────────────────────────
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({})

  // ── Derived ───────────────────────────────────────────────────────────────────
  const editRoleWasArtisan = editingMember?.role === 'artisan'
  const editRoleChangedFromArtisan = editRoleWasArtisan && editRole !== 'artisan'
  const editRolesAvailable = currentRole === 'owner' ? ['owner', ...INVITE_ROLES] : INVITE_ROLES

  function openEdit(member: Member) {
    setEditingMember(member)
    setEditRole(member.role)
    setEditArtisanId(member.artisan_id ?? '')
    setEditError(null)
  }

  function onEditRoleChange(newRole: string) {
    setEditRole(newRole)
    if (newRole !== 'artisan') setEditArtisanId('')
  }

  // ── Send email helper ────────────────────────────────────────────────────────
  async function sendInvitationEmail(invId: string): Promise<{ ok: boolean; fallback?: boolean; message?: string }> {
    try {
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: invId }),
      })
      const data = await res.json() as { ok?: boolean; fallback?: boolean; message?: string; error?: string }
      if (data.ok) return { ok: true }
      return { ok: false, fallback: data.fallback ?? false, message: data.message ?? data.error }
    } catch {
      return { ok: false, fallback: true, message: "Impossible de joindre le serveur." }
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setInviteError('Email requis'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setInviteError('Email invalide'); return }

    const normalizedEmail = email.trim().toLowerCase()

    const alreadyPending = invitations.find(i => i.status === 'pending' && i.email === normalizedEmail)
    if (alreadyPending) { setInviteError('Une invitation est déjà en attente pour cet email.'); return }

    setSending(true)
    setInviteError(null)

    const supabase = createClient()
    const { data: existingMember } = await (supabase as any)
      .from('profiles')
      .select('id, role')
      .eq('org_id', orgId)
      .eq('email', normalizedEmail)
      .maybeSingle() as { data: { id: string; role: string } | null }

    if (existingMember) {
      const roleLabel = ROLE_LABEL[existingMember.role] ?? existingMember.role
      setInviteError(`Cet utilisateur est déjà membre de l'organisation avec le rôle "${roleLabel}". Modifiez son rôle depuis la liste des membres si nécessaire.`)
      setSending(false)
      return
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: inserted, error } = await mutationClient()
      .from('invitations')
      .insert({
        org_id: orgId,
        email: normalizedEmail,
        role: role as any,
        artisan_id: artisanId || null,
        token,
        invited_by: currentUserId,
        expires_at: expiresAt,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }

    if (error || !inserted) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message: string }).message : 'Erreur lors de la création'
      setInviteError(msg)
      setSending(false)
      return
    }

    const link = `${window.location.origin}/invite/${token}`
    const newInv: Invitation = {
      id: inserted.id,
      email: normalizedEmail,
      token,
      role,
      artisan_id: artisanId || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      email_sent_at: null,
      email_last_error: null,
      email_send_count: 0,
    }
    setInvitations(prev => [newInv, ...prev])
    setEmail('')
    setRole('artisan')
    setArtisanId('')

    // Send email automatically
    const emailResult = await sendInvitationEmail(inserted.id)
    setSending(false)

    if (emailResult.ok) {
      setInvitations(prev => prev.map(i =>
        i.id === inserted.id ? { ...i, email_sent_at: new Date().toISOString(), email_send_count: 1 } : i
      ))
      toast(`Invitation envoyée à ${normalizedEmail}`)
      setShowForm(false)
      setGeneratedLink(null)
    } else if (emailResult.fallback) {
      // Email failed but invitation created — show link as fallback
      setGeneratedLink(link)
      toast("Invitation créée, mais l'email n'a pas pu être envoyé.")
    } else {
      setGeneratedLink(link)
      toast(emailResult.message ?? "Invitation créée, vérifiez la configuration email.")
    }
  }

  const handleCopyLink = async (link: string, invId: string) => {
    await navigator.clipboard.writeText(link)
    setCopyStates(prev => ({ ...prev, [invId]: true }))
    setTimeout(() => setCopyStates(prev => ({ ...prev, [invId]: false })), 2000)
  }

  const handleCopy = async () => {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async (invId: string) => {
    const { error } = await mutationClient()
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', invId)
    if (error) { toast(error.message); return }
    setInvitations(prev => prev.map(i => i.id === invId ? { ...i, status: 'revoked' } : i))
    toast('Invitation révoquée')
  }

  const handleResend = async (inv: Invitation) => {
    setResendingId(inv.id)
    const result = await sendInvitationEmail(inv.id)
    setResendingId(null)
    if (result.ok) {
      setInvitations(prev => prev.map(i =>
        i.id === inv.id
          ? { ...i, email_sent_at: new Date().toISOString(), email_send_count: (i.email_send_count ?? 0) + 1, email_last_error: null }
          : i
      ))
      toast(`Email renvoyé à ${inv.email}`)
    } else {
      toast(result.message ?? "Échec de l'envoi. Le lien reste copiable.")
    }
  }

  const handleEditSave = async () => {
    if (!editingMember) return
    setEditSaving(true)
    setEditError(null)
    const supabase = createClient()
    const { data } = await (supabase as any).rpc('update_member_profile', {
      p_member_id: editingMember.id,
      p_new_role: editRole,
      p_new_artisan_id: editArtisanId || null,
    })
    setEditSaving(false)
    const result = data as { success?: boolean; error?: string } | null
    if (result?.error) { setEditError(EDIT_ERROR_MESSAGES[result.error] ?? result.error); return }
    setEditingMember(null)
    toast('Profil membre mis à jour')
    router.refresh()
  }

  const handleRemoveMember = async () => {
    if (!confirmRemoveMember) return
    setRemoveSaving(true)
    const supabase = createClient()
    const { data } = await (supabase as any).rpc('remove_member_from_org', {
      p_member_id: confirmRemoveMember.id,
    })
    setRemoveSaving(false)
    const result = data as { success?: boolean; error?: string } | null
    if (result?.error) {
      toast(EDIT_ERROR_MESSAGES[result.error] ?? result.error)
      setConfirmRemoveMember(null)
      return
    }
    setConfirmRemoveMember(null)
    toast(`${confirmRemoveMember.full_name ?? confirmRemoveMember.email} a été retiré de l'organisation`)
    router.refresh()
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')

  return (
    <div className="max-w-3xl flex flex-col gap-8 py-6">

      {/* ── Members section ── */}
      <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
              Membres ({members.length})
            </h2>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => { setShowForm(!showForm); setGeneratedLink(null) }}>
              <UserPlus className="h-4 w-4" />
              Inviter
            </Button>
          )}
        </div>

        {/* Invite form */}
        {isAdmin && showForm && (
          <form onSubmit={handleInvite} className="bg-background border border-border rounded-xl p-4 flex flex-col gap-3">
            <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Nouvelle invitation</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Email *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jean@example.com"
                  className="h-9 text-sm"
                />
              </div>
              <SelectField label="Rôle *" value={role} onChange={setRole}>
                {INVITE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </SelectField>
            </div>

            {artisans.length > 0 && (
              <SelectField label="Rattacher à un artisan (optionnel)" value={artisanId} onChange={setArtisanId}>
                <option value="">— Aucun artisan —</option>
                {artisans.map(a => (
                  <option key={a.id} value={a.id} disabled={!!a.user_id}>
                    {a.full_name} · {a.trade}{a.user_id ? ' (déjà lié)' : ''}
                  </option>
                ))}
              </SelectField>
            )}

            {inviteError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {inviteError}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={sending}>
                {sending ? 'Envoi en cours…' : (
                  <><Send className="h-3.5 w-3.5" />Inviter par email</>
                )}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setGeneratedLink(null) }}>
                Annuler
              </Button>
            </div>

            {/* Fallback link (shown when email failed) */}
            {generatedLink && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  <p className="text-xs font-600 text-yellow-600">Email non envoyé — partagez ce lien manuellement</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-muted-foreground font-mono bg-background border border-border rounded-lg px-3 py-2 truncate">
                    {generatedLink}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 p-2 rounded-lg border border-border hover:bg-elevated transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Members list */}
        <div className="flex flex-col gap-2">
          {members.map(member => {
            const linkedArtisan = artisans.find(a => a.id === member.artisan_id)
            const canEdit = isAdmin && member.id !== currentUserId
            return (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-700 text-primary">
                  {((member.full_name ?? member.email) || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{member.full_name ?? member.email}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    {linkedArtisan && (
                      <span className="text-[10px] text-orange-500 font-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                        → {linkedArtisan.full_name}
                      </span>
                    )}
                  </div>
                </div>
                <RoleBadge role={member.role} />
                {member.id === currentUserId && (
                  <span className="text-[10px] text-muted-foreground font-500 shrink-0">Vous</span>
                )}
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(member)}
                      title="Modifier"
                      className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmRemoveMember(member)}
                      title="Retirer de l'organisation"
                      className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Pending invitations ── */}
      {isAdmin && pendingInvitations.length > 0 && (
        <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
              Invitations en attente ({pendingInvitations.length})
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {pendingInvitations.map(inv => {
              const artisan = artisans.find(a => a.id === inv.artisan_id)
              const invLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`
              return (
                <div key={inv.id} className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-600 text-foreground truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <RoleBadge role={inv.role} />
                      {artisan && (
                        <span className="text-[10px] text-muted-foreground">→ {artisan.full_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <EmailStatusBadge inv={inv} />
                      <span className="text-[10px] text-muted-foreground">
                        Créée {formatDate(inv.created_at)}
                        {inv.expires_at && ` · Expire ${formatDate(inv.expires_at)}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Copy link */}
                    <button
                      onClick={() => handleCopyLink(`${window.location.origin}/invite/${inv.token}`, inv.id)}
                      title="Copier le lien"
                      className="p-1.5 rounded-lg hover:bg-elevated text-muted-foreground transition-colors"
                    >
                      {copyStates[inv.id]
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {/* Resend email */}
                    <button
                      onClick={() => handleResend(inv)}
                      disabled={resendingId === inv.id}
                      title="Renvoyer l'email"
                      className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors disabled:opacity-50"
                    >
                      {resendingId === inv.id
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                    </button>
                    {/* Revoke */}
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      title="Révoquer"
                      className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Non-admin info ── */}
      {!isAdmin && (
        <section className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            Seuls les propriétaires et administrateurs peuvent inviter des membres.
          </div>
        </section>
      )}

      {/* ── Edit member dialog ── */}
      <Dialog open={!!editingMember} onOpenChange={open => { if (!open) setEditingMember(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le membre</DialogTitle>
            <DialogDescription>{editingMember?.full_name ?? editingMember?.email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <SelectField label="Rôle" value={editRole} onChange={onEditRoleChange} disabled={editSaving}>
              {editRolesAvailable.map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </SelectField>
            {editRole === 'artisan' && (
              <SelectField label="Artisan rattaché" value={editArtisanId} onChange={setEditArtisanId} disabled={editSaving}>
                <option value="">— Aucun artisan —</option>
                {artisans.map(a => {
                  const takenByOther = !!a.user_id && a.user_id !== editingMember?.id
                  return (
                    <option key={a.id} value={a.id} disabled={takenByOther}>
                      {a.full_name} · {a.trade}{takenByOther ? ' (déjà lié)' : ''}
                    </option>
                  )
                })}
              </SelectField>
            )}
            {editRole === 'artisan' && editArtisanId && (
              <button
                type="button"
                onClick={() => setEditArtisanId('')}
                disabled={editSaving}
                className="self-start text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                Détacher l&apos;artisan
              </button>
            )}
            {editRoleChangedFromArtisan && editingMember?.artisan_id && (
              <div className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Ce membre ne sera plus rattaché à un artisan si son rôle n&apos;est plus Artisan.</span>
              </div>
            )}
            {editError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleEditSave} disabled={editSaving} size="sm">
              {editSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditingMember(null)} disabled={editSaving}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove confirmation dialog ── */}
      <Dialog open={!!confirmRemoveMember} onOpenChange={open => { if (!open) setConfirmRemoveMember(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retirer le membre</DialogTitle>
            <DialogDescription>Retirer ce membre de l&apos;organisation. Son compte est conservé.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir retirer{' '}
              <strong className="text-foreground">{confirmRemoveMember?.full_name ?? confirmRemoveMember?.email}</strong>{' '}
              de l&apos;organisation ?
            </p>
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              Ce membre perdra l&apos;accès à toutes les données de l&apos;organisation.
              Son compte Kanvix sera conservé mais sans organisation rattachée.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleRemoveMember}
              disabled={removeSaving}
              size="sm"
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {removeSaving ? 'Suppression…' : 'Retirer le membre'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmRemoveMember(null)} disabled={removeSaving}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
