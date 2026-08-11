'use client'

import { useState } from 'react'
import { X, ShieldCheck, AlertTriangle, KeyRound } from 'lucide-react'
import { useToast } from '@/components/ui/toast-context'
import { ROLE_LABEL, type Role } from '@/lib/permissions'
import {
  assignableRolesFor, roleChangeConsequence, isElevation,
  ROLE_ERROR_MESSAGES, type RoleErrorCode,
} from '@/lib/roles'

interface Props {
  resourceId: string
  personName: string
  currentRole: Role
  callerRole: string | null | undefined
  isSelf: boolean
  onClose: () => void
  onChanged: () => void
}

export function ChangeRoleModal({ resourceId, personName, currentRole, callerRole, isSelf, onClose, onChanged }: Props) {
  const { toast } = useToast()
  const options = assignableRolesFor(callerRole, currentRole, isSelf).filter(r => r !== currentRole)
  const [newRole, setNewRole] = useState<Role | ''>(options[0] ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consequence = newRole ? roleChangeConsequence(newRole) : null
  const elevated = newRole ? isElevation(newRole) : false

  async function handleConfirm() {
    if (!newRole || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/resources/${resourceId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(ROLE_ERROR_MESSAGES[(data.error ?? 'non_autorise') as RoleErrorCode] ?? 'Modification impossible.')
        setSaving(false)
        return
      }
      toast(`Rôle mis à jour : ${ROLE_LABEL[newRole]}`)
      onChanged()
      onClose()
    } catch {
      setError('Impossible de joindre le serveur.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => { if (!saving) onClose() }}
      role="alertdialog" aria-modal="true" aria-labelledby="role-modal-title"
    >
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="h-4 w-4 text-primary shrink-0" />
            <h2 id="role-modal-title" className="font-700 text-foreground text-sm">Modifier le rôle</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-elevated text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Personne</span>
            <span className="text-sm font-600 text-foreground">{personName}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Rôle actuel</span>
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground/85">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />{ROLE_LABEL[currentRole]}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Nouveau rôle</label>
            {options.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground italic">Aucun rôle modifiable pour cette personne.</p>
            ) : (
              <select
                value={newRole}
                onChange={e => { setNewRole(e.target.value as Role); setError(null) }}
                disabled={saving}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                {options.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            )}
          </div>

          {consequence && (
            <div className={elevated
              ? 'flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5'
              : 'flex items-start gap-2 rounded-xl border border-border/40 bg-elevated/50 px-3 py-2.5'}>
              {elevated && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
              <p className={elevated ? 'text-[12.5px] text-amber-700 dark:text-amber-400 leading-relaxed' : 'text-[12.5px] text-muted-foreground leading-relaxed'}>
                {consequence}
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={saving} className="h-9 px-4 rounded-lg border border-border text-sm font-600 text-muted-foreground hover:bg-elevated transition-colors disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={saving || !newRole || options.length === 0}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? 'Modification…' : 'Confirmer le changement'}
          </button>
        </div>
      </div>
    </div>
  )
}
