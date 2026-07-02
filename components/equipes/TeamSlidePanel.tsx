'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Check } from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { cn } from '@/lib/utils'

const PALETTE = [
  '#2563EB', '#7C3AED', '#16A34A', '#DC2626',
  '#D97706', '#0891B2', '#DB2777', '#65A30D',
]

const TYPE_OPTIONS = [
  { value: 'libre', label: 'Libre', description: 'Regroupement libre d\'artisans' },
  { value: 'chantier', label: 'Chantier', description: 'Équipe dédiée à un chantier' },
  { value: 'metier', label: 'Métier', description: 'Équipe par corps de métier' },
  { value: 'entreprise', label: 'Entreprise', description: 'Équipe par entreprise' },
] as const

export type TeamType = 'libre' | 'chantier' | 'metier' | 'entreprise'

export interface TeamFormData {
  id: string
  name: string
  color: string
  type: TeamType
  project_id: string | null
  description: string | null
  lead_id: string | null
  member_ids: string[]
}

interface ArtisanOption {
  id: string
  full_name: string | null
  trade: string | null
  color: string | null
}

interface ProjectOption {
  id: string
  name: string
}

interface Props {
  team: TeamFormData | null
  artisans: ArtisanOption[]
  projects: ProjectOption[]
  orgId: string
  onClose: () => void
}

export function TeamSlidePanel({ team, artisans, projects, orgId, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = team !== null

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [name, setName] = useState(team?.name ?? '')
  const [color, setColor] = useState(team?.color ?? PALETTE[0])
  const [type, setType] = useState<TeamType>(team?.type ?? 'libre')
  const [projectId, setProjectId] = useState(team?.project_id ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [leadId, setLeadId] = useState(team?.lead_id ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(team?.member_ids ?? []),
  )

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est obligatoire'); return }
    if (type === 'chantier' && !projectId) { setError('Sélectionnez un chantier'); return }
    setLoading(true)
    setError(null)

    const mc = mutationClient()
    const teamPayload = {
      org_id: orgId,
      name: name.trim(),
      color,
      type,
      project_id: type === 'chantier' ? projectId || null : null,
      description: description.trim() || null,
      lead_id: leadId || null,
    }

    let teamId = team?.id ?? ''

    if (isEditing) {
      const { error: err } = await mc.from('teams').update(teamPayload).eq('id', teamId).eq('org_id', orgId)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { data, error: err } = await mc.from('teams').insert(teamPayload).select('id').single()
      if (err || !data) { setError(err?.message ?? 'Erreur création'); setLoading(false); return }
      teamId = (data as { id: string }).id
    }

    // Sync members: replace entirely
    const { error: delErr } = await mc.from('team_members').delete().eq('team_id', teamId)
    if (delErr) { setError(delErr.message); setLoading(false); return }

    if (selectedIds.size > 0) {
      const rows = Array.from(selectedIds).map(artisan_id => ({ team_id: teamId, artisan_id }))
      const { error: insErr } = await mc.from('team_members').insert(rows)
      if (insErr) { setError(insErr.message); setLoading(false); return }
    }

    toast(isEditing ? 'Équipe mise à jour' : 'Équipe créée')
    router.refresh()
    onClose()
  }

  const handleDelete = async () => {
    if (!team) return
    setLoading(true)
    const mc = mutationClient()
    await mc.from('team_members').delete().eq('team_id', team.id)
    const { error: err } = await mc.from('teams').delete().eq('id', team.id).eq('org_id', orgId)
    if (err) { setError(err.message); setLoading(false); return }
    toast('Équipe supprimée')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel
      onClose={onClose}
      title={isEditing ? 'Modifier l\'équipe' : 'Nouvelle équipe'}
      subtitle={isEditing ? team.name : undefined}
    >
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        {/* Nom */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Nom <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Ex : Équipe maçonnerie"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-10"
            autoFocus
          />
        </div>

        {/* Type */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">Type d'équipe</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
                  type === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-elevated',
                )}
              >
                <p className="font-600">{opt.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chantier associé (si type = chantier) */}
        {type === 'chantier' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">
              Chantier associé <span className="text-destructive">*</span>
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="">— Sélectionner un chantier —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Description <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <textarea
            placeholder="Rôle, spécialités, notes…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="flex w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Chef d'équipe */}
        {artisans.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">
              Chef d'équipe <span className="text-muted-foreground font-400">(optionnel)</span>
            </label>
            <select
              value={leadId}
              onChange={e => setLeadId(e.target.value)}
              className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="">— Aucun chef désigné —</option>
              {artisans.map(a => (
                <option key={a.id} value={a.id}>{a.full_name ?? 'Artisan'} — {a.trade}</option>
              ))}
            </select>
          </div>
        )}

        {/* Couleur */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">Couleur</label>
          <div className="flex gap-2">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.2)' : undefined,
                  boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Membres */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">
            Membres
            {selectedIds.size > 0 && (
              <span className="ml-2 text-xs font-500 text-primary">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
            )}
          </label>
          {artisans.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun artisan disponible.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-56 overflow-y-auto">
              {artisans.map(a => {
                const checked = selectedIds.has(a.id)
                const aColor = a.color ?? '#94a3b8'
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleMember(a.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      checked ? 'bg-primary/8' : 'hover:bg-elevated',
                    )}
                  >
                    <div
                      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-700"
                      style={{ background: aColor }}
                    >
                      {(a.full_name ?? 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-500 text-foreground truncate">{a.full_name ?? 'Artisan'}</p>
                      <p className="text-xs text-muted-foreground">{a.trade}</p>
                    </div>
                    {checked && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Créer l\'équipe'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
        </div>

        {/* Suppression */}
        {isEditing && (
          <div className="border-t border-border pt-4">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer cette équipe
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground">Confirmer la suppression de <span className="font-600">{team.name}</span> ?</p>
                <p className="text-xs text-muted-foreground">Les artisans membres ne seront pas supprimés.</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-destructive hover:bg-destructive/90 text-white border-0 h-8 text-sm"
                  >
                    {loading ? 'Suppression…' : 'Confirmer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)} className="h-8 text-sm">
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </SlidePanel>
  )
}
