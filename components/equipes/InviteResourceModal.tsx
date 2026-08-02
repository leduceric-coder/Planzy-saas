'use client'

import { useMemo, useState } from 'react'
import {
  X, Send, Shield, AlertTriangle, Copy, Check, Mail,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast-context'
import { ROLE_LABEL, type Role } from '@/lib/permissions'
import { INVITE_ERROR_MESSAGES, RESOURCE_INVITE_ROLES, normalizeEmail, isValidEmail } from '@/lib/invitations'
import type { TaskWithProject } from './ArtisanSidePanel'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectRef { id: string; name: string; color?: string | null }

interface Props {
  artisan: { id: string; full_name: string | null; email: string | null; trade: string | null }
  orgId: string
  currentUserId: string
  projects: ProjectRef[]
  tasks: TaskWithProject[]
  onClose: () => void
  onSent: () => void
}

// Rôles proposés depuis la fiche ressource (source unique : lib/invitations).
const INVITE_ROLE_OPTIONS: Role[] = RESOURCE_INVITE_ROLES

// ── Component ─────────────────────────────────────────────────────────────────

export function InviteResourceModal({ artisan, projects, tasks, onClose, onSent }: Props) {
  const { toast } = useToast()
  const [email, setEmail] = useState(artisan.email ?? '')
  const [role, setRole] = useState<Role>('artisan')
  const [projectId, setProjectId] = useState('')
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallbackLink, setFallbackLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isArtisanInvite = role === 'artisan'
  const projectTasks = useMemo(() => tasks.filter(t => t.project_id === projectId), [tasks, projectId])
  const scopeValid = !isArtisanInvite || (!!projectId && taskIds.length > 0)

  function changeRole(next: Role) {
    setRole(next)
    if (next !== 'artisan') { setProjectId(''); setTaskIds([]) }
    setError(null)
  }
  function changeProject(next: string) {
    setProjectId(next)
    setTaskIds([]) // les tâches dépendent du chantier
  }
  function toggleTask(id: string) {
    setTaskIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

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
      return { ok: false, fallback: true, message: 'Impossible de joindre le serveur.' }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalizedEmail = normalizeEmail(email)
    // Validation légère côté client (feedback rapide). L'AUTORITÉ est le serveur.
    if (!normalizedEmail) { setError('Email requis'); return }
    if (!isValidEmail(normalizedEmail)) { setError(INVITE_ERROR_MESSAGES.invalid_email); return }
    if (isArtisanInvite) {
      if (!projectId || taskIds.length === 0) { setError(INVITE_ERROR_MESSAGES.missing_scope); return }
    }

    setSending(true)
    setError(null)

    // ── Création via le POINT SERVEUR UNIQUE. Le client n'insère plus dans
    // `invitations` : la route applique toutes les gardes anti-doublon (fail-closed)
    // AVANT l'INSERT et renvoie 409/400/403 avec un code d'erreur mappé en message.
    let created: { id: string; token: string } | null = null
    try {
      const res = await fetch('/api/invitations/create-resource-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisanId: artisan.id,
          email: normalizedEmail,
          role,
          projectId: isArtisanInvite ? projectId : null,
          taskIds: isArtisanInvite ? taskIds : null,
        }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; invitation?: { id: string; token: string } }
      if (!res.ok || !data.ok || !data.invitation) {
        setError(INVITE_ERROR_MESSAGES[data.error ?? ''] ?? "Impossible de créer l'invitation.")
        setSending(false)
        return
      }
      created = { id: data.invitation.id, token: data.invitation.token }
    } catch {
      setError('Impossible de joindre le serveur.')
      setSending(false)
      return
    }

    const link = `${window.location.origin}/invite/${created.token}`
    const result = await sendInvitationEmail(created.id)
    setSending(false)

    if (result.ok) {
      toast(`Invitation envoyée à ${normalizedEmail}`)
      onSent()
      onClose()
    } else {
      // Invitation créée mais email non parti → on garde le lien copiable.
      setFallbackLink(link)
      toast(result.message ?? "Invitation créée, mais l'email n'a pas pu être envoyé.")
      onSent()
    }
  }

  async function handleCopy() {
    if (!fallbackLink) return
    await navigator.clipboard.writeText(fallbackLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="font-700 text-foreground text-sm truncate">Inviter sur Kanvix</h2>
              <p className="text-[11px] text-muted-foreground truncate">{artisan.full_name ?? 'Ressource'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-elevated text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {fallbackLink ? (
          <div className="px-5 py-5 flex flex-col gap-4">
            <div className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Invitation créée, mais l&apos;email n&apos;a pas pu être envoyé automatiquement. Partagez ce lien manuellement.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-muted-foreground font-mono bg-background border border-border rounded-lg px-3 py-2 truncate">
                {fallbackLink}
              </div>
              <button onClick={handleCopy} className="shrink-0 p-2 rounded-lg border border-border hover:bg-elevated transition-colors">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            <button onClick={onClose} className="self-end h-9 px-4 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="jean@example.com"
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {!artisan.email && (
                <p className="text-[10.5px] text-muted-foreground/60">Aucun email sur la fiche — saisissez l&apos;adresse d&apos;invitation.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Rôle *</label>
              <select
                value={role}
                onChange={e => changeRole(e.target.value as Role)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {INVITE_ROLE_OPTIONS.map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>

            {/* Périmètre obligatoire pour un artisan (chantier + tâche). */}
            {isArtisanInvite && (
              <div className="flex flex-col gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <p className="text-xs font-600 text-orange-600 dark:text-orange-400">Périmètre d&apos;accès (obligatoire)</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Chantier *</label>
                  <select
                    value={projectId}
                    onChange={e => changeProject(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">{projects.length ? 'Sélectionner un chantier…' : 'Aucun chantier disponible'}</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {projectId && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-600 text-muted-foreground">Tâches du chantier * (au moins une)</label>
                    {projectTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 italic">Aucune tâche active sur ce chantier. Créez une tâche avant d&apos;inviter.</p>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-1.5">
                        {projectTasks.map(t => (
                          <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-elevated cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={taskIds.includes(t.id)}
                              onChange={() => toggleTask(t.id)}
                              className="h-3.5 w-3.5 rounded border-border accent-primary"
                            />
                            <span className="truncate text-foreground/90">{t.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {taskIds.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">{taskIds.length} tâche{taskIds.length > 1 ? 's' : ''} sélectionnée{taskIds.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  L&apos;artisan n&apos;aura accès qu&apos;à ce chantier et à ces tâches. Les rattachements sont créés à l&apos;acceptation de l&apos;invitation.
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={sending || !scopeValid}
                title={!scopeValid ? 'Chantier et au moins une tâche obligatoires pour un artisan' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 transition-colors',
                )}
              >
                {sending ? 'Envoi en cours…' : (<><Send className="h-3.5 w-3.5" />Inviter par email</>)}
              </button>
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-sm font-600 text-muted-foreground hover:bg-elevated transition-colors">
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
